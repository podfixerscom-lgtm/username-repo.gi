"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/actions/action-state";
import {
  createResellerSource,
  syncNow,
  testConnection,
  updateResellerSource,
} from "./actions";

type Source = {
  id: string;
  name: string;
  baseUrl: string;
  authType: "API_KEY" | "BEARER";
  markupType: "FIXED" | "PERCENTAGE";
  markupValue: string;
  isActive: boolean;
  lastSyncedAt: string | null;
};

export function CreateSourceForm() {
  const [state, action, pending] = useActionState(createResellerSource, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form action={action} className="admin-form" ref={formRef}>
      <div className="admin-form-grid">
        <label className="admin-field">
          সোর্সের নাম <span aria-hidden="true">*</span>
          <input name="name" required minLength={2} maxLength={120} />
        </label>
        <label className="admin-field admin-field-wide">
          Base URL <span aria-hidden="true">*</span>
          <input name="baseUrl" type="url" required maxLength={2048} placeholder="https://supplier.example/api" />
          <span className="admin-field-help">শুধু public HTTPS endpoint সমর্থিত। Adapter `/products` endpoint ব্যবহার করে।</span>
        </label>
        <label className="admin-field">
          অথেনটিকেশন <span aria-hidden="true">*</span>
          <select name="authType" required defaultValue="BEARER">
            <option value="BEARER">Bearer token</option>
            <option value="API_KEY">X-API-Key</option>
          </select>
        </label>
        <label className="admin-field">
          API key / token <span aria-hidden="true">*</span>
          <input name="apiKey" type="password" required minLength={8} maxLength={4096} autoComplete="new-password" />
        </label>
        <MarkupFields defaultType="FIXED" defaultValue="0" />
      </div>
      <Feedback state={state} />
      <button className="admin-button" type="submit" disabled={pending}>
        {pending ? "সংরক্ষণ হচ্ছে…" : "রিসেলার সোর্স যোগ করুন"}
      </button>
    </form>
  );
}

export function SourceSettingsForm({ source }: { source: Source }) {
  const [state, action, pending] = useActionState(updateResellerSource, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form action={action} className="admin-form admin-form-nested" ref={formRef}>
      <input type="hidden" name="sourceId" value={source.id} />
      <div className="admin-form-grid">
        <label className="admin-field">
          সোর্সের নাম <span aria-hidden="true">*</span>
          <input name="name" required minLength={2} maxLength={120} defaultValue={source.name} />
        </label>
        <label className="admin-field admin-field-wide">
          Base URL <span aria-hidden="true">*</span>
          <input name="baseUrl" type="url" required maxLength={2048} defaultValue={source.baseUrl} />
        </label>
        <label className="admin-field">
          অথেনটিকেশন <span aria-hidden="true">*</span>
          <select name="authType" required defaultValue={source.authType}>
            <option value="BEARER">Bearer token</option>
            <option value="API_KEY">X-API-Key</option>
          </select>
        </label>
        <label className="admin-field">
          API key / token
          <input name="apiKey" type="password" maxLength={4096} autoComplete="new-password" />
          <span className="admin-field-help">ফাঁকা রাখলে সংরক্ষিত key অপরিবর্তিত থাকবে। অথেনটিকেশন ধরন বদলালে নতুন key দিন।</span>
        </label>
        <MarkupFields defaultType={source.markupType} defaultValue={source.markupValue} />
        <label className="admin-check-field">
          <input name="isActive" type="checkbox" defaultChecked={source.isActive} />
          সোর্স সক্রিয়
        </label>
      </div>
      <Feedback state={state} />
      <button className="admin-button admin-button-secondary" type="submit" disabled={pending}>
        {pending ? "সংরক্ষণ হচ্ছে…" : "সোর্স সেটিংস সংরক্ষণ"}
      </button>
    </form>
  );
}

export function SourceOperations({ sourceId }: { sourceId: string }) {
  const [testState, testAction, testPending] = useActionState(testConnection, {});
  const [syncState, syncAction, syncPending] = useActionState(syncNow, {});

  return (
    <div className="admin-operation-actions">
      <form action={testAction}>
        <input type="hidden" name="sourceId" value={sourceId} />
        <button className="admin-button admin-button-secondary" type="submit" disabled={testPending || syncPending}>
          {testPending ? "পরীক্ষা হচ্ছে…" : "Connection Test"}
        </button>
        <Feedback state={testState} />
      </form>
      <form action={syncAction}>
        <input type="hidden" name="sourceId" value={sourceId} />
        <button className="admin-button" type="submit" disabled={syncPending || testPending}>
          {syncPending ? "সিঙ্ক হচ্ছে…" : "Sync Now"}
        </button>
        <Feedback state={syncState} />
      </form>
    </div>
  );
}

function MarkupFields({
  defaultType,
  defaultValue,
}: {
  defaultType: "FIXED" | "PERCENTAGE";
  defaultValue: string;
}) {
  return (
    <>
      <label className="admin-field">
        মার্কআপ ধরন <span aria-hidden="true">*</span>
        <select name="markupType" required defaultValue={defaultType}>
          <option value="FIXED">নির্দিষ্ট BDT ৳</option>
          <option value="PERCENTAGE">শতাংশ</option>
        </select>
      </label>
      <label className="admin-field">
        মার্কআপ মান <span aria-hidden="true">*</span>
        <input
          name="markupValue"
          type="text"
          inputMode="decimal"
          pattern="[0-9]+([.][0-9]{1,2})?"
          required
          defaultValue={defaultValue}
        />
        <span className="admin-field-help">Percentage-এর সর্বোচ্চ 1000%; মূল্য BDT-তে দুই decimal-এ round হয়।</span>
      </label>
    </>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (state.error) return <p className="admin-feedback admin-feedback-error" role="alert">{state.error}</p>;
  if (state.success) return <p className="admin-feedback admin-feedback-success" role="status">{state.success}</p>;
  return null;
}
