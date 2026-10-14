from app.tools.place_order_tool import place_order_tool
from app.tools.check_order_tool import check_order_tool
from app.tools.cancel_order_tool import cancel_order_tool
from app.tools.check_inventory_tool import check_inventory_tool
from app.utils.llm_utils import get_llm_with_fallbacks
from app.config import settings
from app.tools.request_customer_info import request_customer_info

tools = [check_inventory_tool, place_order_tool, check_order_tool, cancel_order_tool, request_customer_info]

order_agent = get_llm_with_fallbacks(
    api_key=settings.DASHSCOPE_API_KEY_AGENT_1,
    tools=tools
)
