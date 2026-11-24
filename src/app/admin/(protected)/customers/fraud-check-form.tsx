"use client";

import { useActionState } from "react";
import { runFraudHistoryCheck } from "./actions";

export function FraudHistoryCheckForm({ customerId }: { customerId: string }) {
  const [state, action, pending] = useActionState(runFraudHistoryCheck, {});
  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="customerId" value={customerId} />
      <p className="admin-field-help">History-only hook. Connect a configured external provider adapter before treating this as a provider fraud check.</p>
      {state.error ? <p className="admin-feedback admin-feedback-error" role="alert">{state.error}</p> : null}
      {state.success ? <p className="admin-feedback admin-feedback-success" role="status">{state.success}</p> : null}
      <button className="admin-button admin-button-secondary" type="submit" disabled={pending}>
        {pending ? "Checking…" : "Run history check"}
      </button>
    </form>
  );
}
