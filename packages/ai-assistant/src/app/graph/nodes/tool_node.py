"""Execute tools normally, then update explicit state and compact their messages."""

from langchain_core.runnables import RunnableConfig
from langchain_core.messages import AIMessage
from langgraph.prebuilt import ToolNode

from app.graph.states.state import AgentState
from app.utils.tool_results import compact_tool_message, tool_payload
from app.utils.request_budget import check_request_active


def create_tool_node(tools: list):
    """Build a synchronous graph node around LangGraph's standard tool executor."""
    executor = ToolNode(tools)

    def execute_tools(state: AgentState, config: RunnableConfig) -> dict:
        """Checkpoint original results and record search, inventory and order facts."""
        check_request_active()
        result = executor.invoke(state, config)
        calls = {call["id"]: call for call in state["messages"][-1].tool_calls}
        update = {"messages": []}
        customer_form = None
        for message in result["messages"]:
            payload = tool_payload(message)
            args = calls[message.tool_call_id]["args"]
            update["messages"].append(compact_tool_message(message))
            if message.name == "request_customer_info" and isinstance(payload, dict):
                customer_form = payload
            if message.name == "get_products":
                update["search_params"] = dict(args)
                update["search_results"] = payload.get("data") or [] if isinstance(payload, dict) else []
            elif message.name == "check_inventory_tool":
                product_id = args.get("product_id")
                update["inventory_product_id"] = product_id
                update["inventory_results"] = payload.get("data") or [] if isinstance(payload, dict) else []
                update["inspected_product"] = next((
                    p for p in update.get("search_results", state.get("search_results") or [])
                    if p.get("productId") == product_id
                ), None)
            elif message.name in ("check_order_tool", "place_order_tool", "cancel_order_tool"):
                update["last_order_result"] = payload
                if message.name in ("place_order_tool", "cancel_order_tool"):
                    failed = isinstance(payload, dict) and payload.get("success") is False
                    update.update(pending_actions=[], order_draft=None, action_status="failed" if failed else "executed")
        if customer_form:
            # Checkpoint the visible form in the same completed graph step.
            update["messages"].append(AIMessage(
                content=customer_form["message"], additional_kwargs={"customer_form": True},
            ))
        return update

    return execute_tools
