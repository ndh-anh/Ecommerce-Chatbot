"""Validate recipient input and expired requests without live APIs or models."""

import unittest
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import Mock, patch
from app.tools.place_order_tool import place_order_tool
from app.utils.request_budget import request_budget, check_request_active
from app.api.chat.service import ChatService, ChatBusyError


DETAILS = dict(product_id="v1", quantity=2, customer_name="Nguyễn Văn A",
               payment_method="COD", shipping_address="123 Nguyễn Trãi, Hà Nội",
               phone_number="0912345678")


class ChatValidationTests(unittest.TestCase):
    def test_same_session_cannot_run_concurrent_turns_and_lock_is_released(self):
        service = ChatService(None)
        entered, release = Event(), Event()
        def turn(*args):
            entered.set()
            release.wait(2)
            return {"message": "Done"}
        with patch.object(service, "_process_query", side_effect=turn), ThreadPoolExecutor() as executor:
            first = executor.submit(service.process_query, "mua", "session", "u")
            self.assertTrue(entered.wait(1))
            try:
                with self.assertRaises(ChatBusyError):
                    service.process_query("mua lại", "session", "u")
            finally:
                release.set()
            first.result(timeout=2)
        with patch.object(service, "_process_query", return_value={"message": "Next"}):
            self.assertEqual(service.process_query("next", "session", "u")["message"], "Next")

    def test_failed_turn_does_not_leave_session_locked(self):
        service = ChatService(None)
        with patch.object(service, "_process_query", side_effect=TimeoutError):
            for _ in range(2):
                with self.assertRaises(TimeoutError):
                    service.process_query("mua", "session", "u")
    def test_invalid_recipient_never_calls_order_service(self):
        for invalid in [dict(phone_number="123"), dict(customer_name=" "),
                        dict(shipping_address="HN"), dict(quantity=0), dict(payment_method="UNKNOWN")]:
            with self.subTest(invalid=invalid), patch("app.tools.place_order_tool.order_client_manager") as manager:
                result = place_order_tool.invoke({**DETAILS, **invalid},
                    config={"configurable": {"user_id": "u1"}})
                self.assertFalse(result["success"])
                manager.get_client.assert_not_called()

    def test_customer_id_cannot_fall_back_to_recipient_name(self):
        with patch("app.tools.place_order_tool.order_client_manager") as manager:
            result = place_order_tool.invoke(DETAILS, config={"configurable": {}})
            self.assertFalse(result["success"])
            manager.get_client.assert_not_called()

    def test_valid_details_are_normalized_and_sent_with_timeout(self):
        with patch("app.tools.place_order_tool.order_client_manager") as manager:
            manager.get_client.return_value.PlaceOrder.return_value = Mock(order_id="o1", status="PENDING", message="Đã đặt hàng")
            result = place_order_tool.invoke({**DETAILS, "customer_name": "  Nguyễn Văn A  "},
                config={"configurable": {"user_id": "u1"}})
            self.assertTrue(result["success"])
            args, kwargs = manager.get_client.return_value.PlaceOrder.call_args
            self.assertEqual(args[0].customer_id, "u1")
            self.assertEqual(kwargs["timeout"], 10.0)
            self.assertIn("Người nhận: Nguyễn Văn A -", args[0].shipping_address)

    def test_expired_request_cannot_start_an_order_rpc(self):
        context = Mock()
        context.time_remaining.return_value = 0
        context.is_active.return_value = True
        with request_budget(context), patch("app.tools.place_order_tool.order_client_manager") as manager:
            with self.assertRaises(TimeoutError):
                place_order_tool.invoke(DETAILS, config={"configurable": {"user_id": "u1"}})
            manager.get_client.return_value.PlaceOrder.assert_not_called()
        check_request_active()  # Budget must not leak into the next RPC.
