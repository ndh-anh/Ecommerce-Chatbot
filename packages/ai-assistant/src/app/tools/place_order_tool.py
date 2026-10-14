from langchain_core.tools import tool
from langchain_core.runnables import RunnableConfig
from app.clients.order_client import order_client_manager
from app.buf.generated.order.v1 import order_pb2
from pydantic import BaseModel, Field, ConfigDict, ValidationError
from typing import Literal
from app.utils.request_budget import rpc_timeout
import logging

logger = logging.getLogger(__name__)


class PlaceOrderInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    product_id: str = Field(min_length=1)
    quantity: int = Field(ge=1, le=2147483647)
    customer_name: str = Field(min_length=2, max_length=100)
    payment_method: Literal["COD", "CREDIT_CARD"]
    shipping_address: str = Field(min_length=10, max_length=500)
    phone_number: str = Field(pattern=r"^(0[35789][0-9]{8}|\+84[35789][0-9]{8})$")

@tool
def place_order_tool(product_id: str, quantity: int, customer_name: str, payment_method: str, shipping_address: str, phone_number: str, config: RunnableConfig) -> dict:
    """
    Thực hiện đặt hàng (place order) sau khi đã thu thập ĐẦY ĐỦ thông tin.
    Tất cả các tham số đều là bắt buộc và không được tự bịa ra.
    
    Args:
        product_id: ID hoặc mã của sản phẩm (hoặc variant_id nếu có).
        quantity: Số lượng sản phẩm cần đặt.
        customer_name: Tên của khách hàng (người nhận hàng).
        payment_method: Phương thức thanh toán (ví dụ: COD, CREDIT_CARD).
        shipping_address: Địa chỉ giao hàng đầy đủ.
        phone_number: Số điện thoại liên hệ.
    """
    try:
        details = PlaceOrderInput.model_validate({
            "product_id": product_id, "quantity": quantity, "customer_name": customer_name,
            "payment_method": payment_method, "shipping_address": shipping_address,
            "phone_number": phone_number,
        })
        user_id = config.get("configurable", {}).get("user_id", "")
        if not user_id or user_id == "default_user":
            return {"success": False, "message": "Vui lòng đăng nhập trước khi đặt hàng."}
        client = order_client_manager.get_client()
            
        full_address = f"Người nhận: {details.customer_name} - {details.shipping_address} - SĐT: {details.phone_number}"
        request = order_pb2.PlaceOrderRequest(
            customer_id=user_id,
            items=[order_pb2.OrderItem(product_id=details.product_id, quantity=details.quantity)],
            payment_method=details.payment_method,
            shipping_address=full_address
        )
        response = client.PlaceOrder(request, timeout=rpc_timeout())
        return {"order_id": response.order_id, "status": response.status,
                "message": response.message, "success": bool(response.order_id)}
    except ValidationError:
        return {"success": False, "message": "Thông tin nhận hàng chưa hợp lệ. Vui lòng kiểm tra tên, số điện thoại, địa chỉ, số lượng và phương thức thanh toán."}
    except TimeoutError:
        raise
    except Exception:
        logger.exception("Order RPC failed")
        return {"success": False, "message": "Chưa xác nhận được kết quả đặt hàng. Vui lòng kiểm tra lịch sử đơn hàng trước khi đặt lại."}
