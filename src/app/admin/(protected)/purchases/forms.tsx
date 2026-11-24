"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/action-state";
import { createPurchaseOrder, createSupplier, receivePurchaseOrder } from "./actions";

type SupplierOption = { id: string; name: string };
type VariantOption = { id: string; label: string };
type WarehouseOption = { id: string; name: string };

export function SupplierForm() {
  const [state, action, pending] = useActionState(createSupplier, {});
  return (
    <form action={action} className="admin-form">
      <div className="admin-form-grid">
        <label className="admin-field" htmlFor="supplier-name">Supplier name<input id="supplier-name" name="name" minLength={2} maxLength={160} required /></label>
        <label className="admin-field" htmlFor="supplier-phone">Phone<input id="supplier-phone" name="phone" type="tel" maxLength={40} /></label>
        <label className="admin-field" htmlFor="supplier-email">Email<input id="supplier-email" name="email" type="email" maxLength={254} /></label>
        <label className="admin-field" htmlFor="supplier-address">Address<textarea id="supplier-address" name="address" rows={2} maxLength={2000} /></label>
      </div>
      <Feedback state={state} />
      <button className="admin-button admin-button-secondary" type="submit" disabled={pending}>{pending ? "Saving…" : "Add supplier"}</button>
    </form>
  );
}

export function PurchaseOrderForm({
  suppliers,
  variants,
}: {
  suppliers: SupplierOption[];
  variants: VariantOption[];
}) {
  const [state, action, pending] = useActionState(createPurchaseOrder, {});
  return (
    <form action={action} className="admin-form">
      <div className="admin-form-grid">
        <label className="admin-field" htmlFor="purchase-supplier">Supplier
          <select id="purchase-supplier" name="supplierId" required defaultValue="">
            <option value="" disabled>Select supplier</option>
            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
        </label>
        <label className="admin-field" htmlFor="purchase-variant">Physical product / variant
          <select id="purchase-variant" name="variantId" required defaultValue="">
            <option value="" disabled>Select variant</option>
            {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label}</option>)}
          </select>
        </label>
        <label className="admin-field" htmlFor="purchase-quantity">Quantity<input id="purchase-quantity" name="quantity" type="number" min={1} max={999_999_999} step={1} required /></label>
        <label className="admin-field" htmlFor="purchase-unit-cost">Unit cost (৳)<input id="purchase-unit-cost" name="unitCost" type="number" min={0} step="0.01" required /></label>
        <label className="admin-field admin-field-wide" htmlFor="purchase-note">Note<textarea id="purchase-note" name="note" rows={2} maxLength={2000} /></label>
      </div>
      <Feedback state={state} />
      <button className="admin-button" type="submit" disabled={pending || suppliers.length === 0 || variants.length === 0}>
        {pending ? "Creating…" : "Create purchase order"}
      </button>
    </form>
  );
}

export function ReceivePurchaseItemForm({
  itemId,
  maxQuantity,
  warehouses,
}: {
  itemId: string;
  maxQuantity: number;
  warehouses: WarehouseOption[];
}) {
  const [state, action, pending] = useActionState(receivePurchaseOrder, {});
  if (maxQuantity <= 0) return <p>Fully received.</p>;
  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="purchaseOrderItemId" value={itemId} />
      <div className="admin-form-grid">
        <label className="admin-field" htmlFor={`receive-warehouse-${itemId}`}>Receive into warehouse
          <select id={`receive-warehouse-${itemId}`} name="warehouseId" required defaultValue="">
            <option value="" disabled>Select warehouse</option>
            {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
          </select>
        </label>
        <label className="admin-field" htmlFor={`receive-quantity-${itemId}`}>Receive quantity
          <input id={`receive-quantity-${itemId}`} name="quantity" type="number" min={1} max={maxQuantity} step={1} required />
        </label>
      </div>
      <Feedback state={state} />
      <button className="admin-button admin-button-secondary" type="submit" disabled={pending || warehouses.length === 0}>
        {pending ? "Receiving…" : "Receive into FIFO stock"}
      </button>
    </form>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (state.error) return <p className="admin-feedback admin-feedback-error" role="alert">{state.error}</p>;
  if (state.success) return <p className="admin-feedback admin-feedback-success" role="status">{state.success}</p>;
  return null;
}
