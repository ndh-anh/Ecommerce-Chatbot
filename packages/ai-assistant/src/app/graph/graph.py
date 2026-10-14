from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import tools_condition
from app.graph.nodes.tool_node import create_tool_node

from app.graph.states.state import AgentState
from app.graph.nodes.supervisor_node import supervisor_node
from app.graph.nodes.product_node import product_node
from app.graph.nodes.order_node import order_node
from app.graph.nodes.support_node import support_node

from app.tools.get_products import get_products
from app.tools.get_product_details import get_product_details
from app.tools.place_order_tool import place_order_tool
from app.tools.check_order_tool import check_order_tool
from app.tools.cancel_order_tool import cancel_order_tool
from app.tools.check_inventory_tool import check_inventory_tool
from app.tools.get_policy import get_policy
from app.tools.request_customer_info import request_customer_info

def route_order_tools(state: AgentState):
    messages = state.get("messages", [])
    if not messages:
        return "__end__"
    last_message = messages[-1]
    if hasattr(last_message, "tool_calls") and len(last_message.tool_calls) > 0:
        sensitive_names = ["place_order_tool", "cancel_order_tool"]
        if any(tc["name"] in sensitive_names for tc in last_message.tool_calls):
            return "sensitive_order_tools"
        return "safe_order_tools"
    return "supervisor"


def route_safe_order_tools(state: AgentState):
    if state.get("messages") and state["messages"][-1].additional_kwargs.get("customer_form"):
        return "__end__"
    # Inspect only the contiguous tool results from the current execution batch.
    for message in reversed(state.get("messages", [])):
        if message.type != "tool":
            break
        if message.name == "request_customer_info":
            return "__end__"
    return "order"

def create_agent_graph():
    builder = StateGraph(AgentState)
    
    # 1. Thêm Nodes Agent
    builder.add_node("supervisor", supervisor_node)
    builder.add_node("product", product_node)
    builder.add_node("order", order_node)
    builder.add_node("support", support_node)
    
    # Tool Node riêng biệt theo nghiệp vụ
    builder.add_node("product_tools", create_tool_node([get_products, get_product_details, check_inventory_tool]))
    
    # Tách order_tools thành 2 nhánh: an toàn và nhạy cảm
    builder.add_node("safe_order_tools", create_tool_node([check_inventory_tool, check_order_tool, request_customer_info]))
    builder.add_node("sensitive_order_tools", create_tool_node([place_order_tool, cancel_order_tool]))
    
    builder.add_node("support_tools", create_tool_node([get_policy]))
    
    # 2. Luôn bắt đầu từ Supervisor
    builder.add_edge(START, "supervisor")
    
    # 3. Phân phối từ Supervisor
    builder.add_conditional_edges(
        "supervisor",
        lambda state: state.get("next_node"),
        {
            "product": "product",
            "order": "order",
            "support": "support",
            "FINISH": END,
        }
    )
    
    # 4 & 5. Vòng lặp Agent <-> Tool tương ứng
    # Product và Support vẫn dùng tools_condition bình thường
    builder.add_conditional_edges(
        "product",
        tools_condition,
        {"tools": "product_tools", "__end__": "supervisor"}
    )
    builder.add_edge("product_tools", "product")
    
    builder.add_conditional_edges(
        "support",
        tools_condition,
        {"tools": "support_tools", "__end__": "supervisor"}
    )
    builder.add_edge("support_tools", "support")
    
    # Order sử dụng custom router để phân biệt tool
    builder.add_conditional_edges(
        "order",
        route_order_tools,
        {
            "safe_order_tools": "safe_order_tools",
            "sensitive_order_tools": "sensitive_order_tools",
            "__end__": "supervisor",
            "supervisor": "supervisor"
        }
    )
    # A form is a waiting point: return it immediately without another model call.
    builder.add_conditional_edges("safe_order_tools", route_safe_order_tools,
        {"__end__": END, "order": "order"})
    builder.add_edge("sensitive_order_tools", "order")
    
    # Khởi tạo Postgres Checkpointer để lưu state vĩnh viễn (giữ nguyên config mặc định của LangGraph)
    from langgraph.checkpoint.postgres import PostgresSaver
    from psycopg_pool import ConnectionPool
    from app.config import settings
    
    pool = ConnectionPool(
        conninfo=settings.DB_URI,
        max_size=20,
        kwargs={"autocommit": True, "prepare_threshold": None},
    )
    
    checkpointer = PostgresSaver(pool)
    checkpointer.setup() # Tự động tạo các bảng mặc định: checkpoints, checkpoints_writes, checkpoint_migrations
    
    return builder.compile(checkpointer=checkpointer, interrupt_before=["sensitive_order_tools"])

agent_app = create_agent_graph()
