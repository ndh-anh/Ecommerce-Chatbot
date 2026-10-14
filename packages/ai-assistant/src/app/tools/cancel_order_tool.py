from langchain_core.tools import tool
from app.utils.request_budget import rpc_timeout
from app.clients.order_client import order_client_manager
from app.buf.generated.order.v1 import order_pb2

import json

@tool
def cancel_order_tool(order_id: str, reason: str = "User requested cancellation") -> str:
    """
    Hủy một đơn hàng đã đặt.
    
    Args:
        order_id: Mã đơn hàng cần hủy.
        reason: Lý do hủy đơn.
    """
    client = order_client_manager.get_client()
    try:
        request = order_pb2.CancelOrderRequest(order_id=order_id, reason=reason)
        response = client.CancelOrder(request, timeout=rpc_timeout())
        return json.dumps({
            "order_id": order_id,
            "success": response.success,
            "message": response.message
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({
            "order_id": order_id,
            "success": False,
            "message": f"Đã xảy ra lỗi khi hủy đơn hàng: {str(e)}"
        }, ensure_ascii=False)
