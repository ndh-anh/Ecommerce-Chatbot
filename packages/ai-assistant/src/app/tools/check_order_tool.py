from langchain_core.tools import tool
from app.utils.request_budget import rpc_timeout
from app.clients.order_client import order_client_manager
from app.buf.generated.order.v1 import order_pb2

import json

@tool
def check_order_tool(order_id: str) -> str:
    """
    Kiểm tra thông tin và trạng thái của một đơn hàng.
    
    Args:
        order_id: Mã đơn hàng cần kiểm tra.
    """
    client = order_client_manager.get_client()
    try:
        request = order_pb2.GetOrderRequest(order_id=order_id)
        response = client.GetOrder(request, timeout=rpc_timeout())
        if response.status == 'NOT_FOUND':
            return json.dumps({
                "status": "NOT_FOUND",
                "message": f"Không tìm thấy đơn hàng {order_id}."
            }, ensure_ascii=False)
        
        items = [{"product_id": item.product_id, "quantity": item.quantity, "price": item.price} for item in response.items]
        return json.dumps({
            "order_id": order_id,
            "customer_id": response.customer_id,
            "status": response.status,
            "total_amount": response.total_amount,
            "items": items
        }, ensure_ascii=False)
    except Exception as e:
        return json.dumps({
            "status": "ERROR",
            "message": f"Đã xảy ra lỗi khi kiểm tra đơn hàng: {str(e)}"
        }, ensure_ascii=False)
