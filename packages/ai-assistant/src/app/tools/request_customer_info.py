"""Collect shipping details in a validated frontend form before proposing an order."""

from langchain_core.tools import tool


@tool
def request_customer_info(product_id: str, quantity: int) -> dict:
    """Open the recipient form after the customer has selected a variant and quantity.

    Do not invent customer details or place an order. Wait for the form submission.
    """
    if not product_id.strip() or quantity < 1:
        return {"message": "Vui lòng chọn phân loại và số lượng hợp lệ trước."}
    return {
        "message": "Vui lòng điền thông tin người nhận bên dưới. Sau đó bạn sẽ được kiểm tra và xác nhận đơn hàng.",
        "form": "customer_info",
        "product_id": product_id,
        "quantity": quantity,
    }
