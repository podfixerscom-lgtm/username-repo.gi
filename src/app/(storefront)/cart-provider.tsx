"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type CartLine = { variantId: string; quantity: number };

type CartContextValue = {
  items: CartLine[];
  itemCount: number;
  hydrated: boolean;
  addItem: (variantId: string, quantity: number) => boolean;
  setQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
};

const STORAGE_KEY = "crazy-cart.items.v1";
const CartContext = createContext<CartContextValue | null>(null);
let cachedRaw: string | null | undefined;
let cachedItems: CartLine[] = [];
let cartPersistenceFailed = false;
const EMPTY_CART: CartLine[] = [];
const cartSubscribers = new Set<() => void>();

function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.variantId === "string" &&
    record.variantId.length > 0 &&
    Number.isSafeInteger(record.quantity) &&
    Number(record.quantity) > 0 &&
    Number(record.quantity) <= 100;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribeCart, getCartSnapshot, getServerCartSnapshot);
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);

  const addItem = useCallback((variantId: string, quantity: number) => {
    let added = true;
    updateCart((current) => {
      const existing = current.find((item) => item.variantId === variantId);
      if (!existing && current.length >= 50) {
        added = false;
        return current;
      }
      if (!existing) return [...current, { variantId, quantity }];
      return current.map((item) => item.variantId === variantId
        ? { ...item, quantity: Math.min(100, item.quantity + quantity) }
        : item);
    });
    return added;
  }, []);
  const setQuantity = useCallback((variantId: string, quantity: number) => {
    updateCart((current) => current.map((item) => item.variantId === variantId
      ? { ...item, quantity: Math.max(1, Math.min(100, quantity)) }
      : item));
  }, []);
  const removeItem = useCallback((variantId: string) => {
    updateCart((current) => current.filter((item) => item.variantId !== variantId));
  }, []);
  const clearCart = useCallback(() => updateCart(() => []), []);
  const value = useMemo(() => ({
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    hydrated,
    addItem,
    setQuantity,
    removeItem,
    clearCart,
  }), [items, hydrated, addItem, setQuantity, removeItem, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

function getServerCartSnapshot(): CartLine[] {
  return EMPTY_CART;
}

function getCartSnapshot(): CartLine[] {
  if (cartPersistenceFailed) return cachedItems;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    cartPersistenceFailed = true;
    console.error("Could not read the saved cart from local storage.", error);
    return cachedItems;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      const saved: unknown = raw ? JSON.parse(raw) : [];
      cachedItems = Array.isArray(saved) ? saved.filter(isCartLine) : [];
    } catch (error) {
      console.error("Could not parse the saved cart.", error);
      cachedItems = [];
    }
  }
  return cachedItems;
}

function subscribeCart(onChange: () => void) {
  cartSubscribers.add(onChange);
  if (cartSubscribers.size === 1) window.addEventListener("storage", onStorageChange);
  return () => {
    cartSubscribers.delete(onChange);
    if (cartSubscribers.size === 0) window.removeEventListener("storage", onStorageChange);
  };
}

function onStorageChange(event: StorageEvent) {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  cachedRaw = undefined;
  cartPersistenceFailed = false;
  for (const subscriber of cartSubscribers) subscriber();
}

function subscribeHydration(onChange: () => void) {
  queueMicrotask(onChange);
  return () => undefined;
}

function updateCart(update: (current: CartLine[]) => CartLine[]) {
  const next = update(getCartSnapshot());
  cachedItems = next;
  const serialized = JSON.stringify(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, serialized);
    cachedRaw = serialized;
    cartPersistenceFailed = false;
  } catch (error) {
    cartPersistenceFailed = true;
    console.error("Could not persist the cart in local storage.", error);
  }
  for (const subscriber of cartSubscribers) subscriber();
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider.");
  return context;
}
