"use client";

import { useCart } from "../cart-provider";

export function CartCount() {
  const { itemCount, hydrated } = useCart();
  return <span aria-live="polite" aria-atomic="true">
    {hydrated ? `(${itemCount})` : ""}
  </span>;
}
