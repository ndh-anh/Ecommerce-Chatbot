"""Stop new model/tool work when the calling RPC has expired."""

from contextlib import contextmanager
from contextvars import ContextVar
from time import monotonic

_budget = ContextVar("chat_request_budget", default=None)


def check_request_active():
    budget = _budget.get()
    if budget and (monotonic() >= budget[0] or not budget[1]()):
        raise TimeoutError("Chat request deadline exceeded")


def rpc_timeout(seconds=10.0):
    check_request_active()
    budget = _budget.get()
    return min(seconds, max(0.1, budget[0] - monotonic())) if budget else seconds


@contextmanager
def request_budget(context):
    remaining = context.time_remaining()
    token = _budget.set((monotonic() + min(85.0, remaining if remaining is not None else 85.0), context.is_active))
    try:
        yield
    finally:
        _budget.reset(token)
