"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/action-state";
import {
  addProductImage,
  addProductVariant,
  updateProduct,
  updateProductVariant,
} from "../actions";

type Option = { id: string; name: string };

export function ProductSettingsForm({
  product,
  categories,
  brands,
  shippingClasses,
}: {
  product: {
    id: string;
    name: string;
    description: string | null;
    price: string;
    categoryId: string | null;
    brandId: string | null;
    shippingClassId: string | null;
    weightGrams: number;
    allowPreorder: boolean;
    sizeGuide: string | null;
  };
  categories: Option[];
  brands: Option[];
  shippingClasses: Option[];
}) {
  const [state, action, pending] = useActionState(updateProduct, {} as ActionState);

  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="productId" value={product.id} />
      <div className="admin-form-grid">
        <label className="admin-field">
          পণ্যের নাম <span aria-hidden="true">*</span>
          <input name="name" required maxLength={180} defaultValue={product.name} />
        </label>
        <label className="admin-field">
          বর্তমান মূল মূল্য (BDT ৳) <span aria-hidden="true">*</span>
          <input
            name="price"
            type="text"
            inputMode="decimal"
            pattern="[0-9]+([.][0-9]{1,2})?"
            required
            defaultValue={product.price}
          />
        </label>
        <label className="admin-field">
          ক্যাটাগরি
          <select name="categoryId" defaultValue={product.categoryId ?? ""}>
            <option value="">ক্যাটাগরি নেই</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          ব্র্যান্ড
          <select name="brandId" defaultValue={product.brandId ?? ""}>
            <option value="">ব্র্যান্ড নেই</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          Shipping class
          <select name="shippingClassId" defaultValue={product.shippingClassId ?? ""}>
            <option value="">Standard default</option>
            {shippingClasses.map((shippingClass) => (
              <option key={shippingClass.id} value={shippingClass.id}>{shippingClass.name}</option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          ওজন (গ্রাম)
          <input name="weightGrams" type="number" min={0} max={100_000_000} step={1} required defaultValue={product.weightGrams} />
        </label>
        <label className="admin-check-field">
          <input name="allowPreorder" type="checkbox" defaultChecked={product.allowPreorder} />
          স্টক না থাকলেও pre-order অনুমোদন
        </label>
        <label className="admin-field admin-field-wide">
          Size guide
          <textarea name="sizeGuide" rows={3} maxLength={5000} defaultValue={product.sizeGuide ?? ""} />
        </label>
        <label className="admin-field admin-field-wide">
          বিবরণ
          <textarea name="description" rows={5} maxLength={50_000} defaultValue={product.description ?? ""} />
        </label>
      </div>
      <ActionFeedback state={state} />
      <button className="admin-button" type="submit" disabled={pending}>
        {pending ? "সংরক্ষণ হচ্ছে…" : "পণ্যের তথ্য সংরক্ষণ"}
      </button>
    </form>
  );
}

export function AddVariantForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState(addProductVariant, {} as ActionState);

  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="productId" value={productId} />
      <div className="admin-form-grid">
        <label className="admin-field">
          ভ্যারিয়েন্টের নাম
          <input name="name" maxLength={120} placeholder="যেমন: Large / Blue" />
        </label>
        <label className="admin-field">
          SKU <span aria-hidden="true">*</span>
          <input name="sku" required minLength={2} maxLength={120} autoComplete="off" />
        </label>
        <label className="admin-field">
          সাইজ
          <input name="size" maxLength={80} />
        </label>
        <label className="admin-field">
          রং
          <input name="color" maxLength={80} />
        </label>
        <label className="admin-field">
          মূল্য (BDT ৳) <span aria-hidden="true">*</span>
          <input name="price" type="text" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" required />
        </label>
      </div>
      <ActionFeedback state={state} />
      <button className="admin-button" type="submit" disabled={pending}>
        {pending ? "যোগ হচ্ছে…" : "ভ্যারিয়েন্ট যোগ করুন"}
      </button>
    </form>
  );
}

export function VariantEditForm({
  productId,
  variant,
}: {
  productId: string;
  variant: {
    id: string;
    name: string | null;
    sku: string;
    size: string | null;
    color: string | null;
    price: string;
    stockOnHand: number;
    isActive: boolean;
  };
}) {
  const [state, action, pending] = useActionState(updateProductVariant, {} as ActionState);

  return (
    <form action={action} className="admin-form admin-form-nested">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="variantId" value={variant.id} />
      <p className="admin-field-help">বর্তমান মোট স্টক: {variant.stockOnHand} ইউনিট। পরিবর্তন করতে Stock Tools ব্যবহার করুন।</p>
      <div className="admin-form-grid">
        <label className="admin-field">
          ভ্যারিয়েন্টের নাম
          <input name="name" maxLength={120} defaultValue={variant.name ?? ""} />
        </label>
        <label className="admin-field">
          SKU <span aria-hidden="true">*</span>
          <input name="sku" required minLength={2} maxLength={120} defaultValue={variant.sku} />
        </label>
        <label className="admin-field">
          সাইজ
          <input name="size" maxLength={80} defaultValue={variant.size ?? ""} />
        </label>
        <label className="admin-field">
          রং
          <input name="color" maxLength={80} defaultValue={variant.color ?? ""} />
        </label>
        <label className="admin-field">
          মূল্য (BDT ৳) <span aria-hidden="true">*</span>
          <input name="price" type="text" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" required defaultValue={variant.price} />
        </label>
        <label className="admin-check-field">
          <input name="isActive" type="checkbox" defaultChecked={variant.isActive} />
          ভ্যারিয়েন্ট সক্রিয়
        </label>
      </div>
      <ActionFeedback state={state} />
      <button className="admin-button admin-button-secondary" type="submit" disabled={pending}>
        {pending ? "সংরক্ষণ হচ্ছে…" : "ভ্যারিয়েন্ট সংরক্ষণ"}
      </button>
    </form>
  );
}

export function AddImageForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState(addProductImage, {} as ActionState);

  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="productId" value={productId} />
      <div className="admin-form-grid">
        <label className="admin-field admin-field-wide">
          HTTPS ছবির URL <span aria-hidden="true">*</span>
          <input name="url" type="url" required maxLength={2048} />
        </label>
        <label className="admin-field admin-field-wide">
          ছবির বিকল্প বর্ণনা (Alt text) <span aria-hidden="true">*</span>
          <input name="altText" required minLength={2} maxLength={250} />
        </label>
      </div>
      <ActionFeedback state={state} />
      <button className="admin-button" type="submit" disabled={pending}>
        {pending ? "যোগ হচ্ছে…" : "ছবি যোগ করুন"}
      </button>
    </form>
  );
}

function ActionFeedback({ state }: { state: ActionState }) {
  if (state.error) {
    return <p className="admin-feedback admin-feedback-error" role="alert">{state.error}</p>;
  }
  if (state.success) {
    return <p className="admin-feedback admin-feedback-success" role="status">{state.success}</p>;
  }
  return null;
}
