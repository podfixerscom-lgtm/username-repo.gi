"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/action-state";
import {
  createBrand,
  createCategory,
  updateBrand,
  updateCategory,
} from "./actions";

type Option = { id: string; name: string };

export function CreateCategoryForm({ parents }: { parents: Option[] }) {
  const [state, action, pending] = useActionState(createCategory, {});

  return (
    <form action={action} className="admin-form">
      <label className="admin-field">
        ক্যাটাগরির নাম <span aria-hidden="true">*</span>
        <input name="name" required minLength={2} maxLength={120} />
      </label>
      <label className="admin-field">
        প্যারেন্ট ক্যাটাগরি
        <select name="parentId" defaultValue="">
          <option value="">শীর্ষ-স্তরের ক্যাটাগরি</option>
          {parents.map((parent) => <option key={parent.id} value={parent.id}>{parent.name}</option>)}
        </select>
      </label>
      <label className="admin-field">
        বিবরণ
        <textarea name="description" rows={3} maxLength={5000} />
      </label>
      <FormFeedback state={state} />
      <button className="admin-button" type="submit" disabled={pending}>
        {pending ? "যোগ হচ্ছে…" : "ক্যাটাগরি যোগ করুন"}
      </button>
    </form>
  );
}

export function EditCategoryForm({
  category,
}: {
  category: { id: string; name: string; description: string | null };
}) {
  const [state, action, pending] = useActionState(updateCategory, {});
  return (
    <form action={action} className="admin-form admin-form-nested">
      <input type="hidden" name="categoryId" value={category.id} />
      <label className="admin-field">
        ক্যাটাগরির নাম
        <input name="name" required minLength={2} maxLength={120} defaultValue={category.name} />
      </label>
      <label className="admin-field">
        বিবরণ
        <textarea name="description" rows={3} maxLength={5000} defaultValue={category.description ?? ""} />
      </label>
      <FormFeedback state={state} />
      <button className="admin-button admin-button-secondary" type="submit" disabled={pending}>
        {pending ? "সংরক্ষণ হচ্ছে…" : "ক্যাটাগরি সংরক্ষণ"}
      </button>
    </form>
  );
}

export function CreateBrandForm() {
  const [state, action, pending] = useActionState(createBrand, {});
  return (
    <form action={action} className="admin-form">
      <label className="admin-field">
        ব্র্যান্ডের নাম <span aria-hidden="true">*</span>
        <input name="name" required minLength={2} maxLength={120} />
      </label>
      <label className="admin-field">
        বিবরণ
        <textarea name="description" rows={3} maxLength={5000} />
      </label>
      <FormFeedback state={state} />
      <button className="admin-button" type="submit" disabled={pending}>
        {pending ? "যোগ হচ্ছে…" : "ব্র্যান্ড যোগ করুন"}
      </button>
    </form>
  );
}

export function EditBrandForm({
  brand,
}: {
  brand: { id: string; name: string; description: string | null };
}) {
  const [state, action, pending] = useActionState(updateBrand, {});
  return (
    <form action={action} className="admin-form admin-form-nested">
      <input type="hidden" name="brandId" value={brand.id} />
      <label className="admin-field">
        ব্র্যান্ডের নাম
        <input name="name" required minLength={2} maxLength={120} defaultValue={brand.name} />
      </label>
      <label className="admin-field">
        বিবরণ
        <textarea name="description" rows={3} maxLength={5000} defaultValue={brand.description ?? ""} />
      </label>
      <FormFeedback state={state} />
      <button className="admin-button admin-button-secondary" type="submit" disabled={pending}>
        {pending ? "সংরক্ষণ হচ্ছে…" : "ব্র্যান্ড সংরক্ষণ"}
      </button>
    </form>
  );
}

function FormFeedback({ state }: { state: ActionState }) {
  if (state.error) return <p className="admin-feedback admin-feedback-error" role="alert">{state.error}</p>;
  if (state.success) return <p className="admin-feedback admin-feedback-success" role="status">{state.success}</p>;
  return null;
}
