from langchain_core.messages import HumanMessage
from copy import deepcopy
from threading import Lock
from app.utils.tool_results import tool_payload
from app.utils.request_budget import check_request_active


class ChatBusyError(Exception):
    """A previous turn for this checkpoint is still running."""


class ChatService:
    def __init__(self, agent):
        self.agent = agent
        self._active_sessions = set()
        self._session_guard = Lock()

    def process_query(self, message: str, session_id: str = "default_session", user_id: str = "default_user", confirm: bool = None) -> dict:
        # gRPC has several worker threads; never run two turns on the same checkpoint.
        with self._session_guard:
            if session_id in self._active_sessions:
                raise ChatBusyError("A previous chat turn is still running")
            self._active_sessions.add(session_id)
        try:
            return self._process_query(message, session_id, user_id, confirm)
        finally:
            with self._session_guard:
                self._active_sessions.remove(session_id)

    def _process_query(self, message: str, session_id: str, user_id: str, confirm: bool) -> dict:
        check_request_active()
        config = {"configurable": {"thread_id": session_id, "user_id": user_id}, "recursion_limit": 16}
        
        state = self.agent.get_state(config)
        is_suspended = state.next and "sensitive_order_tools" in state.next
        
        if is_suspended:
            if confirm is True:
                # Resume graph execution
                self.agent.update_state(config, {"action_status": "confirmed"}, as_node="order")
                result = self.agent.invoke(None, config=config)
            elif confirm is False:
                # Cancel the tool call by faking a tool message response
                from langchain_core.messages import ToolMessage
                last_message = state.values["messages"][-1]
                tool_calls = last_message.tool_calls if hasattr(last_message, "tool_calls") else []
                cancel_messages = []
                for tc in tool_calls:
                    cancel_messages.append(ToolMessage(
                        tool_call_id=tc["id"], 
                        name=tc["name"], 
                        content="User rejected the confirmation."
                    ))
                result = self.agent.invoke({
                    "messages": cancel_messages, "pending_actions": [],
                    "order_draft": None, "action_status": "rejected",
                }, config=config)
            else:
                # confirm is None but we are suspended, shouldn't happen normally unless frontend bugs out
                # Just return CONFIRMATION_REQUIRED again
                return {
                    "message": "Vui lòng xác nhận thực hiện hành động này.",
                    "data": {"confirmation": True, "actions": state.values.get("pending_actions", [])},
                    "type": "CONFIRMATION_REQUIRED"
                }
        else:
            result = self.agent.invoke(
                {"messages": [HumanMessage(content=message)]},
                config=config,
            )
            
        new_state = self.agent.get_state(config)
        if new_state.next and "sensitive_order_tools" in new_state.next:
            snapshot_data = None
            data_type = None
            messages_list = new_state.values.get("messages", [])
            if messages_list:
                last_message = messages_list[-1]
                pending = new_state.values.get("pending_actions") or [
                    {"name": call["name"], "args": call["args"]}
                    for call in getattr(last_message, "tool_calls", [])
                    if call["name"] in ("place_order_tool", "cancel_order_tool")
                ]
                if pending:
                    snapshot_data = {"confirmation": True, "actions": pending}
                    data_type = pending[0]["name"]
                    
            return {
                "message": "Hệ thống chuẩn bị gọi lệnh. Bạn vui lòng kiểm tra lại thông tin dưới đây và xác nhận nhé?",
                "data": snapshot_data,
                "type": f"CONFIRM_{data_type}" if data_type else "CONFIRMATION_REQUIRED"
            }
        
        messages = result.get("messages", [])
        
        if messages and messages[-1].type == "human":
            from app.utils.llm_utils import get_llm_with_fallbacks
            from langchain_core.messages import SystemMessage
            from app.config import settings
            
            fallback_llm = get_llm_with_fallbacks(
                api_key=settings.DASHSCOPE_API_KEY_AGENT_1,
                temperature=0.7
            )
            fallback_response = fallback_llm.invoke([
                SystemMessage(content="Bạn là trợ lý ảo hỗ trợ khách hàng. Hãy trả lời câu hỏi của khách hàng một cách thân thiện và tự nhiên. Nếu khách hỏi về sản phẩm, hãy hỏi lại chi tiết để tra cứu."),
                messages[-1]
            ])
            self.agent.update_state(config, {"messages": [fallback_response]})
            final_message = fallback_response.content
            # Re-fetch messages since we updated state
            messages = self.agent.get_state(config).values.get("messages", [])
        else:
            final_message = messages[-1].content if messages else "Trợ lý chưa có câu trả lời. Vui lòng thử lại."
        data = None
        data_type = None
        
        # Find the last HumanMessage index to only look at tools called in this turn
        last_human_idx = -1
        for i in range(len(messages) - 1, -1, -1):
            if messages[i].type == "human":
                last_human_idx = i
                break
                
        # Extract data from the last ToolMessage in this turn
        if last_human_idx != -1:
            for i in range(len(messages) - 1, last_human_idx, -1):
                if messages[i].type == "tool" and messages[i].name != "get_product_details":
                    data_type = messages[i].name
                    try:
                        data = deepcopy(tool_payload(messages[i]))
                    except Exception:
                        data = messages[i].content
                    break

        if data_type == "request_customer_info" and isinstance(data, dict):
            final_message = data.get("message", "Vui lòng điền thông tin người nhận.")

        return {
            "message": final_message,
            "data": data,
            "type": data_type or ""
        }

    def get_chat_history(self, session_id: str, user_id: str) -> list:
        config = {"configurable": {"thread_id": session_id, "user_id": user_id}, "recursion_limit": 16}
        state_snapshot = None
        try:
            state_snapshot = self.agent.get_state(config)
            messages = state_snapshot.values.get("messages", [])
        except Exception:
            messages = []
            
        history = []
        import json
        
        for i, msg in enumerate(messages):
            if msg.type == "human":
                history.append({
                    "id": msg.id or f"msg_{i}",
                    "sender": "user",
                    "text": msg.content,
                    "data": ""
                })
            elif msg.type == "ai":
                if msg.content:
                    # Look back for the last tool message before this AI message to attach its data
                    data_payload = ""
                    for j in range(i - 1, -1, -1):
                        prev_msg = messages[j]
                        if prev_msg.type == "human":
                            break
                        if prev_msg.type == "tool" and prev_msg.name != "get_product_details":
                            try:
                                parsed = tool_payload(prev_msg)
                                # Only attach tool data if it looks like a dictionary with 'data'
                                if isinstance(parsed, dict) and "data" in parsed:
                                    data_payload = json.dumps(parsed)
                                else:
                                    data_payload = json.dumps(parsed, ensure_ascii=False)
                            except Exception:
                                data_payload = json.dumps(prev_msg.content, ensure_ascii=False)
                            break
                            
                    history.append({
                        "id": msg.id or f"msg_{i}",
                        "sender": "ai",
                        "text": msg.content,
                        "data": data_payload
                    })
        if state_snapshot and state_snapshot.next and "sensitive_order_tools" in state_snapshot.next:
            pending = state_snapshot.values.get("pending_actions") or []
            if not pending and messages:
                pending = [
                    {"name": call["name"], "args": call["args"]}
                    for call in getattr(messages[-1], "tool_calls", [])
                    if call["name"] in ("place_order_tool", "cancel_order_tool")
                ]
            if pending:
                history.append({
                    "id": "pending_confirmation",
                    "sender": "ai",
                    "text": "Vui lòng kiểm tra thông tin và xác nhận hành động bên dưới.",
                    "data": json.dumps({"confirmation": True, "actions": pending}, ensure_ascii=False),
                })
        return history
