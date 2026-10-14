"""Offline regressions for compact tool context and checkpointed business state."""

import json
import os
import unittest
from unittest.mock import patch

# Keep test runs offline even when the developer's .env enables tracing.
os.environ["LANGSMITH_TRACING"] = "false"
os.environ["LANGCHAIN_TRACING_V2"] = "false"

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.tools import tool
from langchain_core.messages import convert_to_openai_messages
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph

from app.api.chat.service import ChatService
from app.graph.nodes.tool_node import create_tool_node
from app.graph.states.state import AgentState
from app.tools.get_product_details import get_product_details
from app.utils.agent_context import agent_context
from app.utils.order_state import proposed_order_state
from app.utils.tool_results import compact_tool_message, tool_payload


PRODUCT = {
    "productId": "p1", "productName": "Áo polo", "price": 200000,
    "description": "Chất liệu cotton. " * 200 + "Có size XXL.",
    "thumbnailUrl": "https://images.example.com/" + "a" * 300,
    "slug": "ao-polo", "brandName": "Brand", "categoryName": "Áo",
}


def call(name, args, call_id="c1"):
    """Build a model tool call fixture."""
    return {"name": name, "args": args, "id": call_id, "type": "tool_call"}


def tool_graph(tools):
    """Compile a real tool executor with an in-memory checkpoint."""
    builder = StateGraph(AgentState)
    builder.add_node("tools", create_tool_node(tools))
    builder.add_edge(START, "tools")
    builder.add_edge("tools", END)
    return builder.compile(checkpointer=MemorySaver())


class ToolStateTests(unittest.TestCase):
    def test_compaction_preserves_payload_and_tool_link(self):
        """Frontend data stays complete while model input becomes much smaller."""
        original = ToolMessage(name="get_products", tool_call_id="c1", id="t1",
                               content=json.dumps({"message": "Found", "data": [PRODUCT]}))
        compact = compact_tool_message(original)
        self.assertEqual(tool_payload(compact)["data"][0], PRODUCT)
        self.assertLess(len(compact.content), len(original.content) / 3)
        self.assertNotIn("thumbnailUrl", compact.content)
        self.assertNotIn("slug", compact.content)
        self.assertTrue(json.loads(compact.content)["data"][0]["description_truncated"])
        self.assertEqual((compact.id, compact.tool_call_id), ("t1", "c1"))
        self.assertEqual(compact_tool_message(compact).content, compact.content)
        provider_message = convert_to_openai_messages([compact])[0]
        self.assertNotIn("artifact", provider_message)
        self.assertNotIn(PRODUCT["thumbnailUrl"], json.dumps(provider_message))

    def test_legacy_payload_and_errors(self):
        """Old checkpoint messages and failed tools remain readable."""
        for content in ['{"message":"error","data":null}', 'gRPC unavailable']:
            message = ToolMessage(content=content, tool_call_id="c1", name="get_products", status="error")
            compact = compact_tool_message(message)
            self.assertEqual(tool_payload(compact), tool_payload(message))
            self.assertEqual(compact.status, "error")

    def test_real_graph_persists_search_and_artifact(self):
        """Compaction survives graph execution and checkpoint serialization."""
        @tool
        def get_products(keyword: str) -> dict:
            """Find products."""
            return {"data": [PRODUCT]}

        graph = tool_graph([get_products, get_product_details])
        config = {"configurable": {"thread_id": "search"}}
        result = graph.invoke({"messages": [HumanMessage(content="áo"), AIMessage(
            content="", tool_calls=[call("get_products", {"keyword": "áo"})]
        )]}, config)
        self.assertEqual(result["search_params"], {"keyword": "áo"})
        self.assertEqual(result["search_results"], [PRODUCT])
        saved = graph.get_state(config).values["messages"][-1]
        self.assertEqual(saved.artifact["data"], [PRODUCT])
        details = get_product_details.invoke({"name": "get_product_details", "id": "d1",
            "type": "tool_call", "args": {"product_id": "p1", "state": result}})
        self.assertEqual(json.loads(details.content)["description"], PRODUCT["description"])
        self.assertNotIn("state", get_product_details.tool_call_schema.model_json_schema()["properties"])
        followup = graph.invoke({"messages": [HumanMessage(content="chi tiết"), AIMessage(
            content="", tool_calls=[call("get_product_details", {"product_id": "p1"}, "d2")]
        )]}, config)
        self.assertEqual(json.loads(followup["messages"][-1].content)["description"], PRODUCT["description"])

    def test_failed_search_clears_old_results(self):
        """A failed new search cannot leave old results labeled as current."""
        @tool
        def get_products(keyword: str) -> dict:
            """Find products."""
            return {"message": "unavailable", "data": None}

        result = tool_graph([get_products]).invoke({"search_results": [PRODUCT], "messages": [
            AIMessage(content="", tool_calls=[call("get_products", {"keyword": "new"})])
        ]}, {"configurable": {"thread_id": "failed"}})
        self.assertEqual(result["search_results"], [])

    def test_inventory_keeps_variant_ids_stock_and_reference(self):
        """Inventory facts are preserved without treating them as customer selection."""
        variants = [{"variant_id": "v1", "variant_name": "XL", "sku": "P-XL", "stock": 3}]

        @tool
        def check_inventory_tool(product_id: str) -> dict:
            """Check inventory."""
            return {"data": variants}

        result = tool_graph([check_inventory_tool]).invoke({"search_results": [PRODUCT], "messages": [
            AIMessage(content="", tool_calls=[call("check_inventory_tool", {"product_id": "p1"})])
        ]}, {"configurable": {"thread_id": "inventory"}})
        self.assertEqual(result["inventory_results"], variants)
        self.assertEqual(result["inventory_product_id"], "p1")
        self.assertEqual(result["inspected_product"], PRODUCT)
        self.assertNotIn("selected_product", result)

    def test_context_keeps_pairs_and_compacts_old_checkpoints(self):
        """A context window must not begin with an orphaned tool result."""
        messages = [HumanMessage(content="find"), AIMessage(content="", tool_calls=[call("get_products", {})]),
                    ToolMessage(content=json.dumps({"data": [PRODUCT]}), name="get_products", tool_call_id="c1")]
        messages.extend(AIMessage(content="reply") for _ in range(8))
        context = agent_context({"messages": messages}, "product")
        self.assertEqual(context[0].type, "human")
        self.assertEqual(context[1].tool_calls[0]["id"], context[2].tool_call_id)
        self.assertNotIn("thumbnailUrl", context[2].content)
        self.assertIn("thumbnailUrl", messages[2].content)

    def test_history_uses_full_payload_and_skips_internal_detail_tool(self):
        """Restored chat cards contain full data, including image and slug."""
        messages = [HumanMessage(content="find"), compact_tool_message(ToolMessage(
            content=json.dumps({"data": [PRODUCT]}), name="get_products", tool_call_id="c1")),
            ToolMessage(content='{"description":"details"}', name="get_product_details", tool_call_id="d1"),
            AIMessage(content="Found")]
        class Snapshot:
            values = {"messages": messages}
            next = ()
        class Agent:
            def get_state(self, config):
                """Return a checkpoint fixture."""
                return Snapshot()
        history = ChatService(Agent()).get_chat_history("session", "user")
        self.assertEqual(json.loads(history[-1]["data"])["data"][0], PRODUCT)

    def test_history_serializes_plain_text_tool_results(self):
        messages = [HumanMessage(content="đặt hàng"), ToolMessage(
            content="Đặt hàng thành công", tool_call_id="place1", name="place_order_tool"),
            AIMessage(content="Đã đặt hàng")]
        class Snapshot:
            values = {"messages": messages}
            next = ()
        class Agent:
            def get_state(self, config):
                return Snapshot()
        history = ChatService(Agent()).get_chat_history("s", "u")
        self.assertEqual(json.loads(history[-1]["data"]), "Đặt hàng thành công")

    def test_chat_response_keeps_full_frontend_data(self):
        """The live response uses original payloads despite compact tool content."""
        messages = [HumanMessage(content="find"), compact_tool_message(ToolMessage(
            content=json.dumps({"data": [PRODUCT]}), name="get_products", tool_call_id="c1")),
            ToolMessage(content='{"description":"details"}', name="get_product_details", tool_call_id="d1"),
            AIMessage(content="Found")]
        class Snapshot:
            values = {"messages": messages}
            next = ()
        class Agent:
            def get_state(self, config):
                """Return a checkpoint fixture."""
                return Snapshot()
            def invoke(self, input, config):
                """Return a completed turn fixture."""
                return {"messages": messages}
        with patch("app.utils.llm_utils.get_llm_with_fallbacks") as factory:
            factory.return_value.invoke.return_value = AIMessage(content='["p1"]')
            result = ChatService(Agent()).process_query("find", "s", "u")
        self.assertEqual(result["type"], "get_products")
        self.assertEqual(result["data"]["data"][0], PRODUCT)
        factory.assert_not_called()

    def test_customer_form_is_returned_and_restored_without_model_call(self):
        from app.tools.request_customer_info import request_customer_info
        graph = tool_graph([request_customer_info])
        config = {"configurable": {"thread_id": "form", "user_id": "u"}}
        graph.invoke({"messages": [HumanMessage(content="mua 2 cái"), AIMessage(
            content="", tool_calls=[call("request_customer_info", {"product_id": "v1", "quantity": 2})]
        )]}, config)
        class Agent:
            def get_state(self, supplied):
                return graph.get_state(supplied)
            def invoke(self, input, config):
                return graph.get_state(config).values
            def update_state(self, supplied, update):
                return graph.update_state(supplied, update)
        service = ChatService(Agent())
        result = service.process_query("mua", "form", "u")
        self.assertEqual(result["data"]["form"], "customer_info")
        self.assertNotIn('{', result["message"])
        restored = service.get_chat_history("form", "u")
        self.assertEqual(json.loads(restored[-1]["data"])["quantity"], 2)

    def test_unknown_product_details_does_not_invent_data(self):
        """Missing cached product facts produce an explicit lookup instruction."""
        result = get_product_details.invoke({"product_id": "missing", "state": {"messages": []}})
        self.assertIn("message", result)
        self.assertNotIn("description", result)

    def test_proposal_replaces_previous_draft_and_tracks_call_ids(self):
        """A proposal never sets the customer-confirmed status."""
        response = AIMessage(content="", tool_calls=[
            call("check_order_tool", {"order_id": "o1"}, "safe"),
            call("place_order_tool", {"product_id": "v2", "quantity": 2}, "place"),
            call("cancel_order_tool", {"order_id": "o1"}, "cancel")])
        update = proposed_order_state(response)
        self.assertEqual(update["action_status"], "awaiting_confirmation")
        self.assertEqual(update["order_draft"], {"product_id": "v2", "quantity": 2})
        self.assertEqual([a["tool_call_id"] for a in update["pending_actions"]], ["place", "cancel"])
        cancelled = proposed_order_state(AIMessage(content="", tool_calls=[call("cancel_order_tool", {"order_id": "o2"})]))
        self.assertIsNone(cancelled["order_draft"])

    def confirmation_graph(self):
        """Build a real interrupted graph with a counted side-effect tool."""
        executions = []

        @tool
        def cancel_order_tool(order_id: str) -> dict:
            """Cancel an order."""
            executions.append(order_id)
            return {"order_id": order_id, "success": True}

        def order(state):
            """Produce one proposal, then reply after execution or rejection."""
            response = AIMessage(content="Done") if state["messages"][-1].type == "tool" else AIMessage(
                content="", tool_calls=[call("cancel_order_tool", {"order_id": "o1"})])
            return {"messages": [response], **proposed_order_state(response)}

        builder = StateGraph(AgentState)
        builder.add_node("order", order)
        builder.add_node("sensitive_order_tools", create_tool_node([cancel_order_tool]))
        builder.add_edge(START, "order")
        builder.add_conditional_edges("order", lambda s: "sensitive_order_tools" if s["messages"][-1].tool_calls else END)
        builder.add_edge("sensitive_order_tools", "order")
        return builder.compile(checkpointer=MemorySaver(), interrupt_before=["sensitive_order_tools"]), executions

    def test_confirmation_resumes_exact_pending_call(self):
        """Sensitive effects happen only after explicit approval and clear pending state."""
        graph, executions = self.confirmation_graph()
        service = ChatService(graph)
        self.assertEqual(service.process_query("cancel", "confirm", "u")["type"], "CONFIRM_cancel_order_tool")
        self.assertEqual(executions, [])
        history = service.get_chat_history("confirm", "u")
        self.assertTrue(json.loads(history[-1]["data"])["confirmation"])
        service.process_query("yes", "confirm", "u", confirm=True)
        self.assertEqual(executions, ["o1"])
        state = graph.get_state({"configurable": {"thread_id": "confirm"}}).values
        self.assertEqual(state["pending_actions"], [])
        self.assertEqual(state["action_status"], "executed")

    def test_rejection_never_executes_tool_and_clears_draft(self):
        """Declining a proposal cannot trigger its side effect."""
        graph, executions = self.confirmation_graph()
        service = ChatService(graph)
        service.process_query("cancel", "reject", "u")
        service.process_query("no", "reject", "u", confirm=False)
        self.assertEqual(executions, [])
        state = graph.get_state({"configurable": {"thread_id": "reject"}}).values
        self.assertEqual(state["action_status"], "rejected")
        self.assertEqual(state["pending_actions"], [])
        self.assertIsNone(state["order_draft"])

    def test_failed_sensitive_action_is_not_recorded_as_successful(self):
        @tool
        def place_order_tool(product_id: str) -> dict:
            """Reject invalid recipient details."""
            return {"success": False, "message": "Thông tin nhận hàng chưa hợp lệ"}
        result = tool_graph([place_order_tool]).invoke({"messages": [
            AIMessage(content="", tool_calls=[call("place_order_tool", {"product_id": "v1"})])
        ]}, {"configurable": {"thread_id": "invalid_order"}})
        self.assertEqual(result["action_status"], "failed")
        self.assertEqual(result["pending_actions"], [])


if __name__ == "__main__":
    unittest.main()
