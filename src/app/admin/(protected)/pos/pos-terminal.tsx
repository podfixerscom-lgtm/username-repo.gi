"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  getOfflineQueueErrorSnapshot,
  getOfflineQueueSnapshot,
  getServerOfflineQueueErrorSnapshot,
  getServerOfflineQueueSnapshot,
  removeOfflineSale,
  saveOfflineSale,
  subscribeOfflineQueue,
  type OfflineSale,
  type OfflineSaleLine,
  type PosSource,
} from "@/lib/pos/offline-queue";
import { syncOfflineSale } from "./actions";

type Variant = { id: string; sku: string; label: string; price: string; stockOnHand: number };

const sourceNames: Record<PosSource, string> = {
  POS: "Counter POS",
  FACEBOOK: "Facebook",
  PHONE: "Phone",
};

function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getServerOnlineSnapshot() {
  return true;
}

export function PosTerminal({ variants }: { variants: Variant[] }) {
  const queue = useSyncExternalStore(
    subscribeOfflineQueue,
    getOfflineQueueSnapshot,
    getServerOfflineQueueSnapshot,
  );
  const storageError = useSyncExternalStore(
    subscribeOfflineQueue,
    getOfflineQueueErrorSnapshot,
    getServerOfflineQueueErrorSnapshot,
  );
  const [cart, setCart] = useState<OfflineSaleLine[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState(variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [source, setSource] = useState<PosSource>("POS");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const online = useSyncExternalStore(subscribeOnline, getOnlineSnapshot, getServerOnlineSnapshot);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [operationError, setOperationError] = useState("");

  const selectedVariant = variants.find((variant) => variant.id === selectedVariantId);
  const queuedQuantity = useMemo(() => {
    const totals = new Map<string, number>();
    for (const sale of queue) {
      if (sale.state === "SYNCED") continue;
      for (const line of sale.lines) {
        totals.set(line.variantId, (totals.get(line.variantId) ?? 0) + line.quantity);
      }
    }
    return totals;
  }, [queue]);
  const cartTotal = cart.reduce((total, line) => {
    const variant = variants.find((item) => item.id === line.variantId);
    return total + (variant ? Math.round(Number(variant.price) * 100) * line.quantity : 0);
  }, 0) / 100;

  async function addLine() {
    if (!selectedVariant || !Number.isSafeInteger(quantity) || quantity <= 0) return;
    const inCart = cart.find((line) => line.variantId === selectedVariant.id)?.quantity ?? 0;
    if (inCart + quantity > 100) {
      setMessage("A sale can include at most 100 units of one variant.");
      return;
    }
    if (!inCart && cart.length >= 50) {
      setMessage("A sale can include at most 50 variants.");
      return;
    }
    const available = selectedVariant.stockOnHand - (queuedQuantity.get(selectedVariant.id) ?? 0) - inCart;
    if (quantity > available) {
      setMessage(`Only ${Math.max(0, available)} units remain in this local stock snapshot.`);
      return;
    }
    setCart((current) => {
      const existing = current.find((line) => line.variantId === selectedVariant.id);
      return existing
        ? current.map((line) => line.variantId === selectedVariant.id
          ? { ...line, quantity: line.quantity + quantity }
          : line)
        : [...current, { variantId: selectedVariant.id, quantity }];
    });
    setMessage("");
  }

  async function saveSale() {
    if (!cart.length) return;
    setPending(true);
    setMessage("");
    const sale: OfflineSale = {
      idempotencyKey: crypto.randomUUID(),
      source,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      lines: cart,
      createdAt: new Date().toISOString(),
      state: "QUEUED",
    };
    try {
      await saveOfflineSale(sale);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setMessage(`Sale saved locally (${sourceNames[source]}). It has not reached the server yet.`);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Could not save this offline sale.");
    } finally {
      setPending(false);
    }
  }

  async function syncSale(sale: OfflineSale) {
    if (!navigator.onLine || sale.state === "SYNCED" || sale.state === "SYNCING") return;
    const syncing = {
      ...sale,
      state: "SYNCING" as const,
      syncStartedAt: new Date().toISOString(),
      error: undefined,
    };
    try {
      await saveOfflineSale(syncing);
      const result = await syncOfflineSale({
        idempotencyKey: sale.idempotencyKey,
        source: sale.source,
        customerName: sale.customerName,
        customerPhone: sale.customerPhone,
        lines: sale.lines,
      });
      await saveOfflineSale(result.success
        ? {
          ...syncing,
          state: "SYNCED",
          syncStartedAt: undefined,
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          total: result.total,
        }
        : { ...syncing, state: "NEEDS_REVIEW", syncStartedAt: undefined, error: result.error });
    } catch (error) {
      await saveOfflineSale({
        ...sale,
        state: "QUEUED",
        syncStartedAt: undefined,
        error: error instanceof Error ? error.message : "Network sync failed; safe to retry.",
      });
    }
  }

  async function syncQueue() {
    if (!navigator.onLine) {
      setMessage("Reconnect before syncing. Queued sales remain saved in this browser.");
      return;
    }
    setPending(true);
    try {
      for (const sale of queue) {
        if (sale.state !== "SYNCED" && sale.state !== "SYNCING") await syncSale(sale);
      }
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Queue synchronization failed.");
    } finally {
      setPending(false);
    }
  }

  async function syncOne(sale: OfflineSale) {
    if (pending) return;
    setPending(true);
    try {
      await syncSale(sale);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Sale synchronization failed.");
    } finally {
      setPending(false);
    }
  }

  async function removeSale(idempotencyKey: string) {
    try {
      await removeOfflineSale(idempotencyKey);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Could not remove queued sale.");
    }
  }

  return (
    <div className="pos-layout">
      <section className="admin-panel" aria-labelledby="pos-sale-title">
        <h2 id="pos-sale-title">New sale</h2>
        <p role="status" aria-live="polite">{online ? "Online" : "Offline — sales will stay on this device until sync."}</p>
        <div className="admin-form">
          <div className="admin-form-grid">
            <label className="admin-field" htmlFor="pos-source">Source
              <select id="pos-source" value={source} onChange={(event) => setSource(event.currentTarget.value as PosSource)}>
                {Object.entries(sourceNames).map(([value, name]) => <option value={value} key={value}>{name}</option>)}
              </select>
            </label>
            <label className="admin-field" htmlFor="pos-customer-name">Customer name (optional)
              <input id="pos-customer-name" value={customerName} onChange={(event) => setCustomerName(event.currentTarget.value)} maxLength={160} />
            </label>
            <label className="admin-field" htmlFor="pos-customer-phone">Customer phone (optional)
              <input id="pos-customer-phone" type="tel" inputMode="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.currentTarget.value)} maxLength={40} />
            </label>
            <label className="admin-field" htmlFor="pos-variant">Product / SKU
              <select id="pos-variant" value={selectedVariantId} onChange={(event) => setSelectedVariantId(event.currentTarget.value)}>
                {variants.map((variant) => (
                  <option value={variant.id} key={variant.id}>
                    {variant.label} · ৳{Number(variant.price).toFixed(2)} · available {Math.max(0, variant.stockOnHand - (queuedQuantity.get(variant.id) ?? 0))}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-field" htmlFor="pos-quantity">Quantity
              <input id="pos-quantity" type="number" min={1} max={100} step={1} value={quantity} onChange={(event) => setQuantity(Number(event.currentTarget.value))} />
            </label>
          </div>
          <button className="admin-button admin-button-secondary" type="button" onClick={() => void addLine()} disabled={!selectedVariant}>Add item</button>
        </div>
        {cart.length ? (
          <>
            <ul className="admin-plain-list">
              {cart.map((line) => {
                const variant = variants.find((item) => item.id === line.variantId);
                return (
                  <li className="admin-history-item" key={line.variantId}>
                    <strong>{variant?.label ?? line.variantId} × {line.quantity}</strong>
                    <button className="admin-button admin-button-danger" type="button" onClick={() => setCart((items) => items.filter((item) => item.variantId !== line.variantId))}>Remove</button>
                  </li>
                );
              })}
            </ul>
            <p>Snapshot estimate: ৳{cartTotal.toFixed(2)} · server price is authoritative on sync.</p>
            <button className="admin-button" type="button" onClick={() => void saveSale()} disabled={pending}>
              {pending ? "Saving…" : "Save sale to offline queue"}
            </button>
          </>
        ) : <p>Add product variants to create a sale.</p>}
      </section>

      <section className="admin-panel" aria-labelledby="pos-queue-title">
        <div className="admin-page-title-row">
          <h2 id="pos-queue-title">Offline queue ({queue.filter((sale) => sale.state !== "SYNCED").length})</h2>
          <button className="admin-button" type="button" onClick={() => void syncQueue()} disabled={pending || !online}>
            {pending ? "Syncing…" : "Sync queue"}
          </button>
        </div>
        <p>Queued sales remain on this device until removed. Sync uses an idempotency key and validates current server inventory.</p>
        {storageError || operationError ? <p className="admin-feedback admin-feedback-error" role="alert">{storageError || operationError}</p> : null}
        {message ? <p className="admin-feedback admin-feedback-success" role="status">{message}</p> : null}
        {queue.length ? (
          <ul className="admin-plain-list">
            {queue.map((sale) => (
              <li className="admin-history-item" key={sale.idempotencyKey}>
                <strong>{sale.orderNumber ?? `${sourceNames[sale.source]} · ${sale.state}`}</strong>
                <span>{sale.customerName || "Walk-in"} · {sale.lines.length} items · {new Date(sale.createdAt).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}</span>
                {sale.total ? <span>Server total ৳{Number(sale.total).toFixed(2)}</span> : null}
                {sale.error ? <p className="admin-feedback admin-feedback-error" role="alert">{sale.error}</p> : null}
                <div className="admin-actions">
                  {sale.state === "NEEDS_REVIEW" || sale.state === "QUEUED" ? (
                    <button className="admin-button admin-button-secondary" type="button" onClick={() => void syncOne(sale)} disabled={!online || pending}>Retry sync</button>
                  ) : null}
                  {sale.state !== "SYNCING" ? (
                    <button className="admin-button admin-button-danger" type="button" onClick={() => void removeSale(sale.idempotencyKey)}>Remove local record</button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : <p>No offline sales queued.</p>}
      </section>
    </div>
  );
}
