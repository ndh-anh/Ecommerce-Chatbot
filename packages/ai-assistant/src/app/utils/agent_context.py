"""Build model context without exposing stored frontend payloads."""

import json

from langchain_core.messages import SystemMessage, ToolMessage

from app.graph.states.state import AgentState
from app.utils.tool_results import compact_tool_message, product_summary


def agent_context(state: AgentState, role: str) -> list:
    """Use recent messages with intact tool pairs and relevant explicit state."""
    messages = list(state.get("messages", []))
    start = max(0, len(messages) - 10)
    # Start at a user turn so slicing cannot leave orphaned tool results.
    while start > 0 and messages[start].type != "human":
        start -= 1
    recent = [compact_tool_message(m) if isinstance(m, ToolMessage) else m
              for m in messages[start:]]
    facts = {}
    if role in ("product", "order") and state.get("inspected_product"):
        facts["inspected_product"] = product_summary(state["inspected_product"])
    if role == "order":
        for key in ("order_draft", "action_status", "last_order_result"):
            if state.get(key) is not None:
                facts[key] = state[key]
    if facts:
        recent.insert(0, SystemMessage(content=(
            "State nghiệp vụ (inspected_product là sản phẩm đã kiểm tra, không phải lựa chọn đã chốt; "
            "order_draft là đề xuất, không phải xác nhận của khách; "
            "tồn kho phải kiểm tra lại trước khi đặt hàng): "
            + json.dumps(facts, ensure_ascii=False, separators=(",", ":"))
        )))
    return recent
