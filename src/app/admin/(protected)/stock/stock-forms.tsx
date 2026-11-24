"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/action-state";
import {
  createWarehouse,
  recordStockAdjustment,
  recordStockTransfer,
} from "./actions";

type VariantOption = {
  id: string;
  label: string;
  stockOnHand: number;
};
type WarehouseOption = { id: string; name: string; code: string };

export function StockAdjustmentForm({
  variants,
  warehouses,
}: {
  variants: VariantOption[];
  warehouses: WarehouseOption[];
}) {
  const [state, action, pending] = useActionState(recordStockAdjustment, {});
  return (
    <form action={action} className="admin-form">
      <div className="admin-form-grid">
        <label className="admin-field admin-field-wide">
          ভ্যারিয়েন্ট <span aria-hidden="true">*</span>
          <select name="variantId" required defaultValue="">
            <option value="" disabled>ভ্যারিয়েন্ট নির্বাচন করুন</option>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {variant.label} · মোট {variant.stockOnHand} ইউনিট
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          গুদাম <span aria-hidden="true">*</span>
          <select name="warehouseId" required defaultValue="">
            <option value="" disabled>গুদাম নির্বাচন করুন</option>
            {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} ({warehouse.code})</option>)}
          </select>
        </label>
        <label className="admin-field">
          পরিবর্তনের ধরন <span aria-hidden="true">*</span>
          <select name="type" required defaultValue="RECEIVE">
            <option value="RECEIVE">স্টক গ্রহণ</option>
            <option value="RETURN">রিটার্ন</option>
            <option value="DAMAGE">ক্ষতিগ্রস্ত</option>
            <option value="LOSS">হারানো</option>
            <option value="CORRECTION">সংশোধন</option>
          </select>
        </label>
        <label className="admin-field">
          স্টক পরিবর্তন <span aria-hidden="true">*</span>
          <select name="direction" required defaultValue="IN">
            <option value="IN">বাড়ান</option>
            <option value="OUT">কমান</option>
          </select>
        </label>
        <label className="admin-field">
          পরিমাণ (পূর্ণ সংখ্যা) <span aria-hidden="true">*</span>
          <input name="quantity" type="number" min={1} max={999_999_999} step={1} required />
        </label>
        <label className="admin-field">
          প্রতি ইউনিট ক্রয়মূল্য (৳)
          <input
            name="unitCost"
            type="text"
            inputMode="decimal"
            pattern="[0-9]+([.][0-9]{1,2})?"
            aria-describedby="unit-cost-help"
          />
          <span className="admin-field-help" id="unit-cost-help">স্টক বাড়ানোর সময় প্রয়োজন; FIFO ব্যাচের খরচ হিসেবে সংরক্ষিত হবে।</span>
        </label>
        <label className="admin-field admin-field-wide">
          নোট
          <textarea name="note" rows={3} maxLength={2000} />
        </label>
      </div>
      <Feedback state={state} />
      <button className="admin-button" type="submit" disabled={pending || variants.length === 0 || warehouses.length === 0}>
        {pending ? "রেকর্ড হচ্ছে…" : "স্টক পরিবর্তন রেকর্ড করুন"}
      </button>
    </form>
  );
}

export function StockTransferForm({
  variants,
  warehouses,
}: {
  variants: VariantOption[];
  warehouses: WarehouseOption[];
}) {
  const [state, action, pending] = useActionState(recordStockTransfer, {});
  return (
    <form action={action} className="admin-form">
      <div className="admin-form-grid">
        <label className="admin-field admin-field-wide">
          ভ্যারিয়েন্ট <span aria-hidden="true">*</span>
          <select name="variantId" required defaultValue="">
            <option value="" disabled>ভ্যারিয়েন্ট নির্বাচন করুন</option>
            {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.label} · মোট {variant.stockOnHand} ইউনিট</option>)}
          </select>
        </label>
        <label className="admin-field">
          যেখান থেকে <span aria-hidden="true">*</span>
          <select name="fromWarehouseId" required defaultValue="">
            <option value="" disabled>গুদাম নির্বাচন করুন</option>
            {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} ({warehouse.code})</option>)}
          </select>
        </label>
        <label className="admin-field">
          যেখানে <span aria-hidden="true">*</span>
          <select name="toWarehouseId" required defaultValue="">
            <option value="" disabled>গুদাম নির্বাচন করুন</option>
            {warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name} ({warehouse.code})</option>)}
          </select>
        </label>
        <label className="admin-field">
          পরিমাণ <span aria-hidden="true">*</span>
          <input name="quantity" type="number" min={1} max={999_999_999} step={1} required />
        </label>
        <label className="admin-field admin-field-wide">
          নোট
          <textarea name="note" rows={3} maxLength={2000} />
        </label>
      </div>
      <Feedback state={state} />
      <button className="admin-button" type="submit" disabled={pending || variants.length === 0 || warehouses.length < 2}>
        {pending ? "স্থানান্তর হচ্ছে…" : "FIFO স্টক স্থানান্তর করুন"}
      </button>
      {warehouses.length < 2 ? <p className="admin-field-help">স্থানান্তরের জন্য অন্তত দুটি সক্রিয় গুদাম প্রয়োজন।</p> : null}
    </form>
  );
}

export function WarehouseForm() {
  const [state, action, pending] = useActionState(createWarehouse, {});
  return (
    <form action={action} className="admin-form">
      <div className="admin-form-grid">
        <label className="admin-field">
          গুদামের নাম <span aria-hidden="true">*</span>
          <input name="name" required minLength={2} maxLength={120} />
        </label>
        <label className="admin-field">
          গুদাম কোড <span aria-hidden="true">*</span>
          <input name="code" required minLength={2} maxLength={40} pattern="[A-Za-z0-9-]+" autoComplete="off" />
          <span className="admin-field-help">ইংরেজি অক্ষর, সংখ্যা ও হাইফেন ব্যবহার করুন।</span>
        </label>
      </div>
      <Feedback state={state} />
      <button className="admin-button admin-button-secondary" type="submit" disabled={pending}>
        {pending ? "যোগ হচ্ছে…" : "গুদাম যোগ করুন"}
      </button>
    </form>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (state.error) return <p className="admin-feedback admin-feedback-error" role="alert">{state.error}</p>;
  if (state.success) return <p className="admin-feedback admin-feedback-success" role="status">{state.success}</p>;
  return null;
}
