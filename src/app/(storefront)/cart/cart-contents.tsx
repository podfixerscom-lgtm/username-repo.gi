"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { getCartPreview } from "../storefront-actions";
import { useCart } from "../cart-provider";

type Preview = Awaited<ReturnType<typeof getCartPreview>>[number];

export function CartContents() {
  const { items, hydrated, setQuantity, removeItem } = useCart();
  const [preview, setPreview] = useState<{ key: string; products: Preview[]; error: string } | null>(null);
  const key = items.map((item) => item.variantId).join("|");

  useEffect(() => {
    let active = true;
    if (!hydrated) return () => { active = false; };
    getCartPreview(items.map((item) => item.variantId))
      .then((result) => { if (active) setPreview({ key, products: result, error: "" }); })
      .catch(() => {
        if (active) setPreview({ key, products: [], error: "কার্টের পণ্য লোড করা যায়নি। আবার চেষ্টা করুন।" });
      });
    return () => { active = false; };
  }, [hydrated, key, items]);

  if (!hydrated || !preview || preview.key !== key) return <p role="status">কার্ট লোড হচ্ছে…</p>;
  if (preview.error) return <p className="store-error" role="alert">{preview.error}</p>;
  if (items.length === 0) {
    return <div className="store-empty"><p>আপনার কার্ট এখন খালি।</p><Link className="store-button" href="/shop">পণ্য দেখুন</Link></div>;
  }

  const productById = new Map(preview.products.map((product) => [product.id, product]));
  const subtotal = items.reduce((sum, item) => {
    const product = productById.get(item.variantId);
    return sum + (product ? Number(product.price) * item.quantity : 0);
  }, 0);
  const missing = items.filter((item) => !productById.has(item.variantId));

  return (
    <>
      {missing.length ? <p className="store-error" role="status">কিছু পণ্য আর উপলভ্য নয়। Checkout-এর আগে সেগুলো কার্ট থেকে সরান।</p> : null}
      <ul className="cart-list">
        {items.map((item) => {
          const product = productById.get(item.variantId);
          if (!product) {
            return (
              <li className="cart-line" key={item.variantId}>
                <p>এই পণ্যটি আর পাওয়া যাচ্ছে না।</p>
                <button className="store-button store-button-secondary" type="button" onClick={() => removeItem(item.variantId)}>সরান</button>
              </li>
            );
          }
          const unavailable = product.productType === "PHYSICAL" &&
            product.stockOnHand < item.quantity &&
            !product.allowPreorder;
          return (
            <li className="cart-line" key={item.variantId}>
              {product.image ? <Image src={product.image.url} alt={product.image.altText} width={80} height={80} unoptimized /> : null}
              <div className="cart-line-details">
                <h2><Link href={`/shop/${product.slug}`}>{product.productName}</Link></h2>
                <p>{[product.size && `சাইজ ${product.size}`, product.color && `রং ${product.color}`].filter(Boolean).join(" · ") || product.sku}</p>
                <p>৳{Number(product.price).toFixed(2)} × {item.quantity} = ৳{(Number(product.price) * item.quantity).toFixed(2)}</p>
                {unavailable ? <p className="store-error">পর্যাপ্ত স্টক নেই।</p> : null}
              </div>
              <label className="cart-quantity">
                পরিমাণ
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={item.quantity}
                  onChange={(event) => {
                    const quantity = Number(event.currentTarget.value);
                    if (Number.isSafeInteger(quantity) && quantity > 0) setQuantity(item.variantId, quantity);
                  }}
                />
              </label>
              <button className="text-button" type="button" onClick={() => removeItem(item.variantId)}>সরান</button>
            </li>
          );
        })}
      </ul>
      <div className="cart-summary">
        <p aria-live="polite" aria-atomic="true">সাবটোটাল <strong>৳{subtotal.toFixed(2)}</strong></p>
        <p>শিপিং চার্জ checkout-এ এলাকা, ওজন ও shipping class অনুযায়ী হিসাব হবে।</p>
        {missing.length > 0 || preview.products.length === 0
          ? <button className="store-button" type="button" disabled>Checkout-এ যান</button>
          : <Link className="store-button" href="/checkout">Checkout-এ যান</Link>}
      </div>
    </>
  );
}
