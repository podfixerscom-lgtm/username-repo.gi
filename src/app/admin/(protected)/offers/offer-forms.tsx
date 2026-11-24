"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/action-state";
import { saveOffer } from "./actions";

type OfferData = {
  id: string;
  title: string;
  description: string;
  promoCode: string | null;
  discountType: "FIXED" | "PERCENTAGE" | null;
  discountValue: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  showPopup: boolean;
};

export function OfferForm({ offer }: { offer?: OfferData }) {
  const [state, action, pending] = useActionState(saveOffer, {} as ActionState);
  return (
    <form className="admin-form" action={action}>
      <input type="hidden" name="id" value={offer?.id ?? ""} />
      <div className="admin-form-grid">
        <label className="admin-field">শিরোনাম<input name="title" required minLength={2} maxLength={180} defaultValue={offer?.title ?? ""} /></label>
        <label className="admin-field">Promo code<input name="promoCode" maxLength={60} pattern="[A-Za-z0-9_-]*" defaultValue={offer?.promoCode ?? ""} /></label>
        <label className="admin-field">Discount type
          <select name="discountType" defaultValue={offer?.discountType ?? "NONE"}>
            <option value="NONE">কোনো code discount নয়</option>
            <option value="FIXED">Fixed BDT</option>
            <option value="PERCENTAGE">Percentage</option>
          </select>
        </label>
        <label className="admin-field">Discount value<input name="discountValue" type="number" min="0" step="0.01" defaultValue={offer?.discountValue ?? ""} /></label>
        <label className="admin-field">শুরু (ঐচ্ছিক)<input name="startsAt" type="datetime-local" defaultValue={offer?.startsAt ?? ""} /></label>
        <label className="admin-field">শেষ (ঐচ্ছিক)<input name="endsAt" type="datetime-local" defaultValue={offer?.endsAt ?? ""} /></label>
        <label className="admin-field admin-field-wide">বিবরণ<textarea name="description" rows={3} maxLength={5000} defaultValue={offer?.description ?? ""} /></label>
        <label className="admin-check-field"><input name="isActive" type="checkbox" defaultChecked={offer?.isActive ?? false} />সক্রিয়</label>
        <label className="admin-check-field"><input name="showPopup" type="checkbox" defaultChecked={offer?.showPopup ?? false} />স্টোরফ্রন্টে popup দেখান</label>
      </div>
      {state.error ? <p className="admin-feedback admin-feedback-error" role="alert">{state.error}</p> : null}
      {state.success ? <p className="admin-feedback admin-feedback-success" role="status">{state.success}</p> : null}
      <button className="admin-button" type="submit" disabled={pending}>{pending ? "সংরক্ষণ হচ্ছে…" : offer ? "Offer আপডেট করুন" : "Offer তৈরি করুন"}</button>
    </form>
  );
}
