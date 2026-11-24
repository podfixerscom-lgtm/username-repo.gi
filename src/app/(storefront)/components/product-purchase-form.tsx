"use client";

import { useState, type FormEvent } from "react";
import { useCart } from "../cart-provider";
import { trackStorefrontEvent } from "@/lib/marketing/client";

type Variant = {
  id: string;
  name: string | null;
  sku: string;
  size: string | null;
  color: string | null;
  price: string;
  stockOnHand: number;
};

export function ProductPurchaseForm({
  product,
  variants,
}: {
  product: { id: string; name: string; slug: string; type: "PHYSICAL" | "DIGITAL"; allowPreorder: boolean };
  variants: Variant[];
}) {
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const { addItem } = useCart();
  const selected = variants.find((variant) => variant.id === variantId);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) {
      setMessage("এই পণ্যের কোনো সক্রিয় ভ্যারিয়েন্ট নেই।");
      return;
    }
    if (product.type === "PHYSICAL" && !product.allowPreorder && selected.stockOnHand < quantity) {
      setMessage("নির্বাচিত পরিমাণে পর্যাপ্ত স্টক নেই।");
      return;
    }
    if (!addItem(selected.id, quantity)) {
      setMessage("কার্টে সর্বোচ্চ ৫০টি ভিন্ন পণ্য রাখা যাবে।");
      return;
    }
    trackStorefrontEvent("AddToCart", {
      content_ids: [product.id],
      content_name: product.name,
      value: Number(selected.price) * quantity,
      currency: "BDT",
    });
    setMessage("পণ্যটি কার্টে যোগ হয়েছে।");
  }

  return (
    <form className="purchase-form" onSubmit={submit}>
      <label>
        ভ্যারিয়েন্ট
        <select value={variantId} onChange={(event) => setVariantId(event.currentTarget.value)} required>
          {variants.map((variant) => {
            const options = [variant.name, variant.size && `সাইজ ${variant.size}`, variant.color && `রং ${variant.color}`]
              .filter(Boolean)
              .join(" · ");
            return (
              <option key={variant.id} value={variant.id}>
                {options || variant.sku} — ৳{Number(variant.price).toFixed(2)}
                {product.type === "PHYSICAL" ? ` · স্টক ${variant.stockOnHand}` : ""}
              </option>
            );
          })}
        </select>
      </label>
      <label>
        পরিমাণ
        <input type="number" min={1} max={100} value={quantity} onChange={(event) => {
          const parsed = Number(event.currentTarget.value);
          if (Number.isSafeInteger(parsed)) setQuantity(Math.max(1, Math.min(100, parsed)));
        }} />
      </label>
      <button className="store-button" type="submit" disabled={!selected}>কার্টে যোগ করুন</button>
      <p className="store-status" role="status" aria-live="polite">{message}</p>
    </form>
  );
}
