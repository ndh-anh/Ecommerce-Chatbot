from typing import Annotated, Any, List, Literal, Optional
from typing_extensions import TypedDict
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages
from app.typed_dict.product import ProductDict


class SearchParameters(TypedDict, total=False):
    """Filters using the exact argument names exposed by get_products."""

    keyword: Optional[str]
    category_name: Optional[str]
    brand_name: Optional[str]
    min_price: Optional[float]
    max_price: Optional[float]
    page: int
    page_size: int
    sort: Optional[str]

class OrderDraft(TypedDict, total=False):
    """Arguments proposed for an order; never evidence of customer confirmation."""

    product_id: str
    quantity: int
    customer_name: str
    payment_method: str
    shipping_address: str
    phone_number: str


class PendingAction(TypedDict):
    """A tool call awaiting the existing graph confirmation boundary."""

    tool_call_id: str
    name: str
    args: dict[str, Any]


class AgentState(TypedDict, total=False):
    messages: Annotated[list[BaseMessage], add_messages]
    next_node: Optional[str]

    search_params: Optional[SearchParameters]
    search_results: Optional[List[ProductDict]]
    selected_product: Optional[ProductDict]
    inspected_product: Optional[ProductDict]
    inventory_product_id: Optional[str]
    inventory_results: Optional[list[dict[str, Any]]]
    order_draft: Optional[OrderDraft]
    pending_actions: list[PendingAction]
    action_status: Optional[Literal["awaiting_confirmation", "confirmed", "rejected", "executed", "failed"]]
    last_order_result: Any
