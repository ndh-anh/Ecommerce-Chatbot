from langchain_core.tools import tool
from app.utils.request_budget import rpc_timeout
from app.clients.inventory_client import inventory_client_manager
from app.buf.generated.product.v1 import product_pb2


@tool
def check_inventory_tool(product_id: str) -> dict:
    """
    Kiểm tra tồn kho và các biến thể (variants) của sản phẩm.
    
    Args:
        product_id: ID hoặc mã của sản phẩm.
    """
    try:
        client = inventory_client_manager.get_client()
        request = product_pb2.GetProductInventoryRequest(productId=product_id)
        response = client.GetProductInventory(request, timeout=rpc_timeout())

        if not response.variants:
            return {
                "message": f"Sản phẩm {product_id} không tồn tại hoặc chưa có biến thể nào.",
                "data": None
            }

        variants_data = [
            {
                "variant_id": v.variantId,
                "variant_name": v.variantName,
                "sku": v.sku,
                "stock": v.stock,
            }
            for v in response.variants
        ]

        return {
            "message": f"Tìm thấy {len(variants_data)} phân loại cho sản phẩm {product_id}.",
            "data": variants_data
        }
    except Exception as e:
        return {
            "message": f"Lỗi khi kiểm tra tồn kho: {str(e)}",
            "data": None
        }
