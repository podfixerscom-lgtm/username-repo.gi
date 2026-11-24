"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { calculateShippingCharge } from "@/lib/checkout/shipping";
import { trackStorefrontEvent } from "@/lib/marketing/client";
import { useCart } from "../cart-provider";
import { getCartPreview } from "../storefront-actions";
import { placeOrder } from "./actions";
import type { CheckoutActionState } from "./actions";

type Zone = "DHAKA" | "CHATTOGRAM" | "REST_OF_BANGLADESH";
type CartPreview = Awaited<ReturnType<typeof getCartPreview>>[number];
const zoneNames: Record<Zone, string> = {
  DHAKA: "ঢাকা",
  CHATTOGRAM: "চট্টগ্রাম",
  REST_OF_BANGLADESH: "বাংলাদেশের অন্যান্য এলাকা",
};
const deliveryZones: readonly Zone[] = ["DHAKA", "CHATTOGRAM", "REST_OF_BANGLADESH"];

export function CheckoutForm({
  rates,
  shippingClasses,
  freeDeliveryAboveBDT,
}: {
  rates: Array<{ zone: Zone; baseCharge: string; includedWeightGrams: number; extraPerKgCharge: string }>;
  shippingClasses: Array<{ id: string; code: string; surcharge: string }>;
  freeDeliveryAboveBDT: number | null;
}) {
  const [state, action, pending] = useActionState<CheckoutActionState, FormData>(placeOrder, {});
  const { items, hydrated, clearCart } = useCart();
  const [products, setProducts] = useState<CartPreview[]>([]);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [zone, setZone] = useState<Zone>(rates[0]?.zone ?? "DHAKA");
  const router = useRouter();
  const processedOrder = useRef("");

  useEffect(() => {
    let active = true;
    if (!hydrated) return () => { active = false; };
    getCartPreview(items.map((item) => item.variantId))
      .then((result) => {
        if (active) {
          setProducts(result);
          setPreviewFailed(false);
        }
      })
      .catch(() => {
        if (active) {
          setProducts([]);
          setPreviewFailed(true);
        }
      });
    return () => { active = false; };
  }, [hydrated, items]);

  useEffect(() => {
    trackStorefrontEvent("InitiateCheckout", { currency: "BDT" });
  }, []);

  useEffect(() => {
    if (!state.orderId || processedOrder.current === state.orderId) return;
    processedOrder.current = state.orderId;
    trackStorefrontEvent("Purchase", {
      currency: "BDT",
      ...(state.orderTotal ? { value: Number(state.orderTotal) } : {}),
    });
    clearCart();
    router.push(`/thank-you/${state.orderId}`);
  }, [state.orderId, state.orderTotal, clearCart, router]);

  const cartPayload = useMemo(() => JSON.stringify(items), [items]);
  const byId = new Map(products.map((product) => [product.id, product]));
  const subtotal = items.reduce((total, item) => total + (byId.has(item.variantId)
    ? Number(byId.get(item.variantId)?.price) * item.quantity
    : 0), 0);
  const selectedRate = rates.find((rate) => rate.zone === zone);
  const shippingEstimate = selectedRate && products.length
    ? calculateShippingCharge(items.flatMap((item) => {
      const product = byId.get(item.variantId);
      if (!product) return [];
      const classInfo = shippingClasses.find((shippingClass) => shippingClass.id === product.shippingClassId)
        ?? shippingClasses.find((shippingClass) => shippingClass.code === "STANDARD");
      return [{
        productType: product.productType,
        quantity: item.quantity,
        weightGrams: product.weightGrams,
        shippingClassId: classInfo?.id ?? product.shippingClassId,
        shippingSurcharge: classInfo?.surcharge ?? product.shippingSurcharge,
      }];
    }), selectedRate, subtotal, freeDeliveryAboveBDT)
    : 0;
  const unavailable = items.some((item) => !byId.has(item.variantId));

  if (!hydrated) return <p role="status">কার্ট লোড হচ্ছে…</p>;
  if (items.length === 0) {
    return <div className="store-empty"><p>আপনার কার্টে কোনো পণ্য নেই।</p><Link href="/shop">পণ্য দেখুন</Link></div>;
  }

  return (
    <div className="checkout-layout">
      <form className="store-form checkout-form" action={action}>
        <input type="hidden" name="cart" value={cartPayload} />
        <fieldset>
          <legend>যোগাযোগের তথ্য</legend>
          <label>পূর্ণ নাম<input name="customerName" autoComplete="name" minLength={2} maxLength={160} required /></label>
          <label>ফোন নম্বর<input name="customerPhone" type="tel" autoComplete="tel" minLength={8} maxLength={40} required /></label>
          <label>ইমেইল (ঐচ্ছিক)<input name="customerEmail" type="email" autoComplete="email" maxLength={254} /></label>
        </fieldset>
        <fieldset>
          <legend>ডেলিভারির ঠিকানা</legend>
          <label>ঠিকানা<input name="address" autoComplete="street-address" minLength={5} maxLength={3000} required /></label>
          <label>এলাকা (ঐচ্ছিক)<input name="area" maxLength={120} /></label>
          <label>শহর<input name="city" autoComplete="address-level2" minLength={2} maxLength={120} required /></label>
          <label>ডেলিভারি এলাকা
            <select name="deliveryZone" value={zone} onChange={(event) => {
              const nextZone = deliveryZones.find((candidate) => candidate === event.currentTarget.value);
              if (nextZone) setZone(nextZone);
            }} required>
              {rates.map((rate) => <option key={rate.zone} value={rate.zone}>{zoneNames[rate.zone]}</option>)}
            </select>
          </label>
        </fieldset>
        <fieldset>
          <legend>পেমেন্ট পদ্ধতি</legend>
          <label className="payment-option"><input name="paymentMethod" type="radio" value="COD" defaultChecked /> ক্যাশ অন ডেলিভারি</label>
          <label className="payment-option"><input name="paymentMethod" type="radio" value="BKASH" /> bKash</label>
          <label className="payment-option"><input name="paymentMethod" type="radio" value="NAGAD" /> Nagad</label>
          <label className="payment-option"><input name="paymentMethod" type="radio" value="SSLCOMMERZ" /> SSLCommerz</label>
          <p>Online payment এখনো সংযুক্ত নয়। অনলাইন পদ্ধতিতে অর্ডার payment confirmation-এর অপেক্ষায় থাকবে; checkout কোনো payment সফল বলে দেখাবে না।</p>
        </fieldset>
        <label>Promo code (ঐচ্ছিক)<input name="promoCode" autoComplete="off" maxLength={60} /></label>
        {state.error ? <p className="store-error" role="alert">{state.error}</p> : null}
        {previewFailed ? <p className="store-error" role="alert">কার্টের পণ্য যাচাই করা যায়নি। পৃষ্ঠা refresh করে আবার চেষ্টা করুন।</p> : null}
        <button className="store-button" type="submit" disabled={pending || unavailable || products.length !== items.length}>
          {pending ? "অর্ডার তৈরি হচ্ছে…" : "অর্ডার নিশ্চিত করুন"}
        </button>
      </form>

      <aside className="checkout-summary" aria-labelledby="checkout-summary-title">
        <h2 id="checkout-summary-title">আপনার অর্ডার</h2>
        <ul>
          {items.map((item) => {
            const product = byId.get(item.variantId);
            return <li key={item.variantId}>
              <span>{product?.productName ?? "পণ্য লোড হচ্ছে"} × {item.quantity}</span>
              <strong>{product ? `৳${(Number(product.price) * item.quantity).toFixed(2)}` : "—"}</strong>
            </li>;
          })}
        </ul>
        <p>সাবটোটাল <strong>৳{subtotal.toFixed(2)}</strong></p>
        <p>শিপিং estimate ({zoneNames[zone]}) <strong>৳{shippingEstimate.toFixed(2)}</strong></p>
        <p>Promo code-এর ছাড় server-এ যাচাই হবে।</p>
        <p className="checkout-total" role="status" aria-live="polite" aria-atomic="true">
          মোটের estimate <strong>৳{(subtotal + shippingEstimate).toFixed(2)}</strong>
        </p>
        {unavailable ? <p className="store-error" role="alert">কার্টের একটি পণ্য আর উপলভ্য নয়। <Link href="/cart">কার্ট সংশোধন করুন</Link></p> : null}
      </aside>
    </div>
  );
}
