"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/action-state";
import { submitProductReview } from "../storefront-actions";

export function ReviewForm({ productId }: { productId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(submitProductReview, {});
  return (
    <form className="store-form" action={action}>
      <input type="hidden" name="productId" value={productId} />
      <label>আপনার নাম<input name="customerName" autoComplete="name" minLength={2} maxLength={120} required /></label>
      <label>রেটিং
        <select name="rating" defaultValue="5" required>
          <option value="5">৫ - চমৎকার</option>
          <option value="4">৪ - ভালো</option>
          <option value="3">৩ - ঠিক আছে</option>
          <option value="2">২ - খারাপ</option>
          <option value="1">১ - খুব খারাপ</option>
        </select>
      </label>
      <label>শিরোনাম (ঐচ্ছিক)<input name="title" maxLength={180} /></label>
      <label>রিভিউ<textarea name="body" minLength={10} maxLength={5000} rows={4} required /></label>
      {state.error ? <p className="store-error" role="alert">{state.error}</p> : null}
      {state.success ? <p className="store-success" role="status">{state.success}</p> : null}
      <button className="store-button" type="submit" disabled={pending}>{pending ? "জমা হচ্ছে…" : "রিভিউ জমা দিন"}</button>
    </form>
  );
}
