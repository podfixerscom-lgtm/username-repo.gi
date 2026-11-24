"use client";

import { useActionState, useEffect, useRef } from "react";
import { addDigitalAsset } from "./actions";

type ProductOption = { id: string; name: string };
type VariantOption = { id: string; sku: string; productName: string };

export function DigitalAssetForm({
  products,
  variants,
  type,
}: {
  products: ProductOption[];
  variants: VariantOption[];
  type: "DOWNLOAD" | "LICENSE_KEY";
}) {
  const [state, action, pending] = useActionState(addDigitalAsset, {});
  const formRef = useRef<HTMLFormElement>(null);
  const isDownload = type === "DOWNLOAD";

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form action={action} className="admin-form" ref={formRef}>
      <input type="hidden" name="type" value={type} />
      <div className="admin-form-grid">
        <label className="admin-field">
          ডিজিটাল পণ্য <span aria-hidden="true">*</span>
          <select name="productId" required defaultValue="">
            <option value="" disabled>পণ্য নির্বাচন করুন</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
        </label>
        <label className="admin-field">
          ভ্যারিয়েন্ট (ঐচ্ছিক)
          <select name="variantId" defaultValue="">
            <option value="">পণ্যের সব ভ্যারিয়েন্ট</option>
            {variants.map((variant) => (
              <option key={variant.id} value={variant.id}>{variant.productName} · {variant.sku}</option>
            ))}
          </select>
          <span className="admin-field-help">ভ্যারিয়েন্ট নির্বাচন করলে সেটি নির্বাচিত পণ্যের হতে হবে।</span>
        </label>
        <label className="admin-field admin-field-wide">
          সম্পদের নাম <span aria-hidden="true">*</span>
          <input name="label" required minLength={2} maxLength={180} />
        </label>
        {isDownload ? (
          <>
            <label className="admin-field">
              ফাইলের নাম <span aria-hidden="true">*</span>
              <input name="fileName" required maxLength={255} />
            </label>
            <label className="admin-field admin-field-wide">
              HTTPS ডাউনলোড URL <span aria-hidden="true">*</span>
              <input name="downloadUrl" type="url" required maxLength={2048} />
              <span className="admin-field-help">এখানে একটি নিরাপদ URL রেফারেন্স রাখা হবে; ফাইল আপলোড বা checkout delivery এই ধাপে নেই।</span>
            </label>
            <input type="hidden" name="licenseKey" value="" />
          </>
        ) : (
          <>
            <label className="admin-field admin-field-wide">
              লাইসেন্স কী <span aria-hidden="true">*</span>
              <textarea name="licenseKey" required minLength={8} maxLength={4096} autoComplete="new-password" />
              <span className="admin-field-help">কী AES-256-GCM দিয়ে এনক্রিপ্ট করে সংরক্ষণ হবে এবং আবার দেখানো হবে না।</span>
            </label>
            <input type="hidden" name="fileName" value="" />
            <input type="hidden" name="downloadUrl" value="" />
          </>
        )}
      </div>
      {state.error ? <p className="admin-feedback admin-feedback-error" role="alert">{state.error}</p> : null}
      {state.success ? <p className="admin-feedback admin-feedback-success" role="status">{state.success}</p> : null}
      <button className="admin-button" type="submit" disabled={pending || products.length === 0}>
        {pending ? "সংরক্ষণ হচ্ছে…" : isDownload ? "ডাউনলোড রেফারেন্স যোগ করুন" : "লাইসেন্স কী এনক্রিপ্ট ও সংরক্ষণ"}
      </button>
      {products.length === 0 ? <p className="admin-field-help">আগে একটি ডিজিটাল পণ্য তৈরি করুন।</p> : null}
    </form>
  );
}
