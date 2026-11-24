"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/action-state";
import { saveDeliveryRate, saveShippingClass, saveStorefrontSettings } from "./actions";

export function StorefrontSettingsForm({
  settings,
}: {
  settings: {
    storeName: string;
    tagline: string;
    orderNumberPrefix: string;
    contactEmail: string | null;
    contactPhone: string | null;
    contactAddress: string | null;
    themePrimaryColor: string;
    themeAccentColor: string;
    announcementText: string;
    homeHeroTitle: string;
    homeHeroDescription: string;
    footerMessage: string;
    autoMoveToPending: boolean;
    freeDeliveryAboveBDT: string | null;
  };
}) {
  const [state, action, pending] = useActionState(saveStorefrontSettings, {});
  return (
    <form action={action} className="admin-form">
      <div className="admin-form-grid">
        <label className="admin-field">স্টোরের নাম <input name="storeName" required maxLength={160} defaultValue={settings.storeName} /></label>
        <label className="admin-field">ট্যাগলাইন <input name="tagline" required maxLength={240} defaultValue={settings.tagline} /></label>
        <label className="admin-field">অর্ডার নম্বর প্রিফিক্স <input name="orderNumberPrefix" required maxLength={20} pattern="[A-Za-z0-9-]+" defaultValue={settings.orderNumberPrefix} /></label>
        <label className="admin-field">যোগাযোগের ইমেইল <input name="contactEmail" type="email" maxLength={254} defaultValue={settings.contactEmail ?? ""} /></label>
        <label className="admin-field">যোগাযোগের ফোন <input name="contactPhone" type="tel" maxLength={40} defaultValue={settings.contactPhone ?? ""} /></label>
        <label className="admin-field admin-field-wide">যোগাযোগের ঠিকানা <textarea name="contactAddress" rows={2} maxLength={2000} defaultValue={settings.contactAddress ?? ""} /></label>
        <label className="admin-field">Primary theme color <input name="themePrimaryColor" type="color" required defaultValue={settings.themePrimaryColor} /></label>
        <label className="admin-field">Accent theme color <input name="themeAccentColor" type="color" required defaultValue={settings.themeAccentColor} /></label>
        <label className="admin-field admin-field-wide">Announcement bar <input name="announcementText" maxLength={240} defaultValue={settings.announcementText} /></label>
        <label className="admin-field">Home hero title <input name="homeHeroTitle" required maxLength={180} defaultValue={settings.homeHeroTitle} /></label>
        <label className="admin-field admin-field-wide">Home hero description <textarea name="homeHeroDescription" rows={4} maxLength={5000} defaultValue={settings.homeHeroDescription} /></label>
        <label className="admin-field admin-field-wide">Footer message <textarea name="footerMessage" rows={3} maxLength={5000} defaultValue={settings.footerMessage} /></label>
        <label className="admin-check-field">
          <input name="autoMoveToPending" type="checkbox" defaultChecked={settings.autoMoveToPending} />
          স্টক-স্বল্প pre-order অর্ডার স্বয়ংক্রিয়ভাবে Pending করুন
        </label>
        <label className="admin-field" htmlFor="free-delivery-threshold">
          Free delivery threshold (৳)
          <input
            id="free-delivery-threshold"
            name="freeDeliveryAboveBDT"
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            aria-describedby="free-delivery-help"
            defaultValue={settings.freeDeliveryAboveBDT ?? ""}
          />
          <span className="admin-field-help" id="free-delivery-help">
            ফাঁকা রাখলে free delivery বন্ধ থাকবে। threshold পূরণ হলে zone, weight ও shipping class-সহ delivery charge মওকুফ হবে।
          </span>
        </label>
      </div>
      <Feedback state={state} />
      <button className="admin-button" type="submit" disabled={pending}>{pending ? "সংরক্ষণ হচ্ছে…" : "স্টোরফ্রন্ট সেটিংস সংরক্ষণ"}</button>
    </form>
  );
}

export function DeliveryRateForm({
  rate,
  label,
}: {
  rate: {
    zone: string;
    baseCharge: string;
    includedWeightGrams: number;
    extraPerKgCharge: string;
  };
  label: string;
}) {
  const [state, action, pending] = useActionState(saveDeliveryRate, {});
  return (
    <form action={action} className="admin-subpanel admin-form">
      <h3>{label}</h3>
      <input type="hidden" name="zone" value={rate.zone} />
      <div className="admin-form-grid">
        <label className="admin-field">প্রথম ধাপের চার্জ (৳)<input name="baseCharge" type="number" min="0" step="0.01" required defaultValue={rate.baseCharge} /></label>
        <label className="admin-field">অন্তর্ভুক্ত ওজন (গ্রাম)<input name="includedWeightGrams" type="number" min="1" step="1" required defaultValue={rate.includedWeightGrams} /></label>
        <label className="admin-field">অতিরিক্ত প্রতি কেজি (৳)<input name="extraPerKgCharge" type="number" min="0" step="0.01" required defaultValue={rate.extraPerKgCharge} /></label>
      </div>
      <Feedback state={state} />
      <button className="admin-button admin-button-secondary" type="submit" disabled={pending}>{pending ? "সংরক্ষণ হচ্ছে…" : "Rate সংরক্ষণ"}</button>
    </form>
  );
}

export function ShippingClassForm({
  shippingClass,
}: {
  shippingClass?: { code: string; name: string; surcharge: string; isActive: boolean };
}) {
  const [state, action, pending] = useActionState(saveShippingClass, {});
  return (
    <form action={action} className="admin-subpanel admin-form">
      <h3>{shippingClass ? shippingClass.name : "Shipping class যোগ করুন"}</h3>
      <div className="admin-form-grid">
        <label className="admin-field">Class code <input name="code" required minLength={2} maxLength={40} pattern="[A-Za-z0-9_-]+" defaultValue={shippingClass?.code ?? ""} readOnly={Boolean(shippingClass)} /></label>
        <label className="admin-field">Class name <input name="name" required minLength={2} maxLength={80} defaultValue={shippingClass?.name ?? ""} /></label>
        <label className="admin-field">প্রতি package surcharge (৳)<input name="surcharge" type="number" min="0" step="0.01" required defaultValue={shippingClass?.surcharge ?? "0"} /></label>
        <label className="admin-check-field"><input name="isActive" type="checkbox" defaultChecked={shippingClass?.isActive ?? true} />সক্রিয়</label>
      </div>
      <Feedback state={state} />
      <button className="admin-button admin-button-secondary" type="submit" disabled={pending}>{pending ? "সংরক্ষণ হচ্ছে…" : "Shipping class সংরক্ষণ"}</button>
    </form>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (state.error) return <p className="admin-feedback admin-feedback-error" role="alert">{state.error}</p>;
  if (state.success) return <p className="admin-feedback admin-feedback-success" role="status">{state.success}</p>;
  return null;
}
