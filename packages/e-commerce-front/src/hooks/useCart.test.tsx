import type { ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
} from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCart,
  getCartItems,
  getGetCartQueryKey,
  getGetCartItemsQueryKey,
} from "@e-commerce/api-client/endpoints/cart";
import { cartQueryOptions, useCart, useCartBadge } from "./useCart";

vi.mock("@e-commerce/api-client/endpoints/cart", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@e-commerce/api-client/endpoints/cart")
  >()),
  getCart: vi.fn(),
  getCartItems: vi.fn(),
}));

const cart = {
  cartId: "cart-1",
  userId: "user-1",
  updatedAt: "2026-10-13T00:00:00Z",
};
const clients: QueryClient[] = [];

function setup() {
  const client = new QueryClient();
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

beforeEach(() => vi.resetAllMocks());
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  focusManager.setFocused(undefined);
});

describe("cart queries", () => {
  it("caches a missing cart without retrying on unrelated cache events, focus or remount", async () => {
    vi.mocked(getCart).mockRejectedValue({
      isAxiosError: true,
      response: { status: 404 },
    });
    const { client, wrapper } = setup();
    const badge = renderHook(() => useCartBadge("user-1"), { wrapper });
    await waitFor(() =>
      expect(
        client.getQueryData(getGetCartQueryKey({ userId: "user-1" })),
      ).toBeNull(),
    );

    await act(async () => {
      await client.fetchQuery({
        queryKey: ["products"],
        queryFn: async () => [],
      });
      client.setQueryData(["notifications"], []);
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    badge.unmount();
    const remounted = renderHook(() => useCartBadge("user-1"), { wrapper });
    expect(remounted.result.current).toBe(0);
    expect(getCart).toHaveBeenCalledTimes(1);
    expect(getCartItems).not.toHaveBeenCalled();
    expect(await client.fetchQuery(cartQueryOptions("user-1"))).toBeNull();
    expect(getCart).toHaveBeenCalledTimes(1);
  });

  it("shares requests and updates the badge when cart items are invalidated", async () => {
    vi.mocked(getCart).mockResolvedValue(cart);
    vi.mocked(getCartItems).mockResolvedValue({
      cartItems: [{ quantity: 1 }],
    } as Awaited<ReturnType<typeof getCartItems>>);
    const { client, wrapper } = setup();
    const badge = renderHook(() => useCartBadge("user-1"), { wrapper });
    const page = renderHook(() => useCart("user-1"), { wrapper });
    await waitFor(() => expect(badge.result.current).toBe(1));
    expect(page.result.current.data).toEqual(cart);
    expect(getCart).toHaveBeenCalledTimes(1);

    vi.mocked(getCartItems).mockResolvedValue({
      cartItems: [{ quantity: 3 }],
    } as Awaited<ReturnType<typeof getCartItems>>);
    await act(async () => {
      await client.invalidateQueries({
        queryKey: getGetCartItemsQueryKey(cart.cartId),
      });
    });
    await waitFor(() => expect(badge.result.current).toBe(3));
    expect(getCartItems).toHaveBeenCalledTimes(2);
    expect(getCart).toHaveBeenCalledTimes(1);
  });

  it("loads the newly created cart and its items after invalidation", async () => {
    const { client, wrapper } = setup();
    client.setQueryData(getGetCartQueryKey({ userId: "user-1" }), null);
    vi.mocked(getCartItems).mockResolvedValue({
      cartItems: [{ quantity: 2 }],
    } as Awaited<ReturnType<typeof getCartItems>>);
    const badge = renderHook(() => useCartBadge("user-1"), { wrapper });
    expect(badge.result.current).toBe(0);
    vi.mocked(getCart).mockResolvedValue(cart);
    await act(async () => {
      await client.invalidateQueries({
        queryKey: getGetCartQueryKey({ userId: "user-1" }),
      });
    });
    await waitFor(() => expect(badge.result.current).toBe(2));
    expect(getCart).toHaveBeenCalledTimes(1);
  });

  it("does not request a cart without a user and clears the badge on logout", async () => {
    const { client, wrapper } = setup();
    client.setQueryData(getGetCartQueryKey({ userId: "user-1" }), cart);
    client.setQueryData(getGetCartItemsQueryKey(cart.cartId), {
      cartItems: [{ quantity: 1 }],
    });
    const badge = renderHook(
      ({ userId }: { userId: string | null }) => useCartBadge(userId),
      {
        wrapper,
        initialProps: { userId: null } as { userId: string | null },
      },
    );
    expect(badge.result.current).toBe(0);
    badge.rerender({ userId: "user-1" });
    await waitFor(() => expect(badge.result.current).toBe(1));
    badge.rerender({ userId: null });
    expect(badge.result.current).toBe(0);
    expect(getCart).not.toHaveBeenCalled();
    expect(getCartItems).not.toHaveBeenCalled();
  });

  it("keeps server failures as errors instead of treating them as an empty cart", async () => {
    const error = { isAxiosError: true, response: { status: 500 } };
    vi.mocked(getCart).mockRejectedValue(error);
    const { wrapper } = setup();
    const page = renderHook(() => useCart("user-1"), { wrapper });
    await waitFor(() => expect(page.result.current.isError).toBe(true));
    expect(page.result.current.error).toBe(error);
    expect(page.result.current.data).toBeUndefined();
    expect(getCart).toHaveBeenCalledTimes(1);
  });

  it("aborts the request when the last cart consumer unmounts", async () => {
    vi.mocked(getCart).mockReturnValue(new Promise(() => {}));
    const { wrapper } = setup();
    const page = renderHook(() => useCart("user-1"), { wrapper });
    await waitFor(() => expect(getCart).toHaveBeenCalledTimes(1));
    const signal = vi.mocked(getCart).mock.calls[0][2];
    expect(signal?.aborted).toBe(false);
    page.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
