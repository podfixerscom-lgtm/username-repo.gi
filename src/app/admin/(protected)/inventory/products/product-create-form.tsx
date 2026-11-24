"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/action-state";
import { createProduct } from "../actions";

type Option = { id: string; name: string };
type ShippingOption = { id: string; name: string };

export function ProductCreateForm({
  categories,
  brands,
  shippingClasses,
}: {
  categories: Option[];
  brands: Option[];
  shippingClasses: ShippingOption[];
}) {
  const [state, action, pending] = useActionState(createProduct, {} as ActionState);

  return (
    <form action={action} className="admin-form">
      <div className="admin-form-grid">
        <label className="admin-field">
          পণ্যের নাম <span aria-hidden="true">*</span>
          <input name="name" required maxLength={180} autoComplete="off" />
        </label>
        <label className="admin-field">
          SKU <span aria-hidden="true">*</span>
          <input name="sku" required minLength={2} maxLength={120} autoComplete="off" />
        </label>
        <label className="admin-field">
          পণ্যের ধরন <span aria-hidden="true">*</span>
          <select name="type" required defaultValue="PHYSICAL">
            <option value="PHYSICAL">ফিজিক্যাল</option>
            <option value="DIGITAL">ডিজিটাল</option>
          </select>
        </label>
        <label className="admin-field">
          প্রারম্ভিক মূল্য (BDT ৳) <span aria-hidden="true">*</span>
          <input
            name="price"
            type="text"
            inputMode="decimal"
            pattern="[0-9]+([.][0-9]{1,2})?"
            required
            aria-describedby="product-price-help"
          />
          <span className="admin-field-help" id="product-price-help">
            সর্বোচ্চ দুই দশমিক স্থান। প্রাথমিক ভ্যারিয়েন্টেও এই মূল্য বসবে।
          </span>
        </label>
        <label className="admin-field">
          ক্যাটাগরি
          <select name="categoryId" defaultValue="">
            <option value="">ক্যাটাগরি নেই</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          ব্র্যান্ড
          <select name="brandId" defaultValue="">
            <option value="">ব্র্যান্ড নেই</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          Shipping class
          <select name="shippingClassId" defaultValue="">
            <option value="">Standard default</option>
            {shippingClasses.map((shippingClass) => (
              <option key={shippingClass.id} value={shippingClass.id}>{shippingClass.name}</option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          ওজন (গ্রাম)
          <input name="weightGrams" type="number" min={0} max={100_000_000} step={1} defaultValue={500} />
        </label>
        <label className="admin-check-field">
          <input name="allowPreorder" type="checkbox" />
          স্টক না থাকলেও pre-order অনুমোদন
        </label>
        <label className="admin-field admin-field-wide">
          Size guide
          <textarea name="sizeGuide" rows={3} maxLength={5000} placeholder="যেমন: M — বুক 38–40 in" />
        </label>
        <label className="admin-field admin-field-wide">
          বিবরণ
          <textarea name="description" rows={5} maxLength={50_000} />
        </label>
      </div>
      {state.error ? <p className="admin-feedback admin-feedback-error" role="alert">{state.error}</p> : null}
      <button className="admin-button" type="submit" disabled={pending}>
        {pending ? "সংরক্ষণ হচ্ছে…" : "পণ্য তৈরি করুন"}
      </button>
    </form>
  );
}
