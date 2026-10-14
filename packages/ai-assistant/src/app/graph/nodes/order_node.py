
from app.graph.states.state import AgentState
from app.agents.order_agent import order_agent
from langchain_core.messages import SystemMessage
from app.utils.agent_context import agent_context
from app.utils.order_state import proposed_order_state

ORDER_SYSTEM_PROMPT = """Bạn là chuyên viên xử lý đơn hàng.
Nhiệm vụ: Sử dụng công cụ để tạo đơn, hủy đơn hoặc cập nhật thông tin đơn hàng cho khách.
Chỉ tập trung vào thao tác đơn hàng và xác nhận trạng thái."""

# This is the prompt actually passed to the model; agents/order_agent.py only binds tools.
ORDER_SYSTEM_PROMPT += """
Quy trình bắt buộc:
1. Kiểm tra tồn kho bằng check_inventory_tool, để khách chọn variant_id và số lượng.
2. Khi đã chọn phân loại và số lượng, nếu thiếu thông tin người nhận, gọi
   request_customer_info(product_id=variant_id, quantity=so_luong) để mở form.
   Không yêu cầu khách gõ tên, điện thoại và địa chỉ trong chat. Không gọi các tool khác
   trong cùng lượt mở form. Chờ khách gửi form rồi mới tiếp tục.
3. Không tự bịa thông tin người nhận. Dùng đúng thông tin khách gửi từ form.
4. Chỉ gọi place_order_tool khi đầy đủ tên, số điện thoại hợp lệ, địa chỉ,
   số lượng và phương thức thanh toán. Hệ thống sẽ yêu cầu khách xác nhận riêng;
   gửi form không đồng nghĩa với xác nhận đặt hàng.
5. Trả lời bằng tiếng Việt tự nhiên; không xuất JSON, mã tool hay tham số nội bộ.
"""

def order_node(state: AgentState) -> dict:
    """Run the order agent and record its exact proposed sensitive actions."""
    sys_message = SystemMessage(content=ORDER_SYSTEM_PROMPT)
        
    # Ghép system message vào đầu danh sách messages gửi cho LLM
    response = order_agent.invoke([sys_message] + agent_context(state, "order"))
    
    return {"messages": [response], **proposed_order_state(response)}
