"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import {
  getCart,
  getCartItems,
  getGetCartQueryKey,
  getGetCartItemsQueryKey,
} from "@e-commerce/api-client/endpoints/cart";
import { isAxiosError } from "axios";

const STATUS_NOT_FOUND = 404;
const CART_STALE_TIME = 60_000;

export const cartQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: getGetCartQueryKey({ userId }),
    queryFn: async ({ signal }) => {
      try {
        return await getCart({ userId }, undefined, signal);
      } catch (error) {
        // A missing cart is valid data. Cache it until a cart is created.
        if (
          isAxiosError(error) &&
          error.response?.status === STATUS_NOT_FOUND
        ) {
          return null;
        }
        throw error;
      }
    },
    staleTime: (query) =>
      query.state.data === null ? Infinity : CART_STALE_TIME,
    retry: false,
  });

export function useCart(userId: string | null) {
  return useQuery({
    ...cartQueryOptions(userId ?? ""),
    enabled: !!userId,
  });
}

export function useCartBadge(userId: string | null) {
  const { data: cart } = useCart(userId);
  const cartId = userId ? cart?.cartId : undefined;
  const { data: items } = useQuery({
    queryKey: getGetCartItemsQueryKey(cartId ?? ""),
    queryFn: ({ signal }) => getCartItems(cartId!, undefined, signal),
    enabled: !!cartId,
    staleTime: CART_STALE_TIME,
    retry: false,
  });

  return cartId
    ? (items?.cartItems.reduce((sum, item) => sum + item.quantity, 0) ?? 0)
    : 0;
}
