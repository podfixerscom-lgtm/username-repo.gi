"use client";

import { useActionState } from "react";
import type { OrderStatus } from "@/generated/prisma/client";
import type { ActionState } from "@/lib/actions/action-state";
import { getAllowedOrderStatusTransitions } from "@/lib/orders/status";
import { addOrderNote, setOrderStatus } from "./actions";

const statusLabels: Record<OrderStatus, string> = {
  PENDING: "Confirm",
  AWAITING_PAYMENT: "Payment pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

export function OrderStatusControls({ orderId, status }: { orderId: string; status: OrderStatus }) {
  return (
    <div className="admin-actions">
      {getAllowedOrderStatusTransitions(status).map((nextStatus) => (
        <StatusAction key={nextStatus} orderId={orderId} nextStatus={nextStatus} />
      ))}
    </div>
  );
}

function StatusAction({ orderId, nextStatus }: { orderId: string; nextStatus: OrderStatus }) {
  const [state, action, pending] = useActionState(setOrderStatus, {});
  return (
    <form action={action}>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="nextStatus" value={nextStatus} />
      <button
        className={nextStatus === "CANCELLED" ? "admin-button admin-button-danger" : "admin-button admin-button-secondary"}
        type="submit"
        disabled={pending}
      >
        {pending ? "Updating…" : statusLabels[nextStatus]}
      </button>
      {state.error ? <p className="admin-feedback admin-feedback-error" role="alert">{state.error}</p> : null}
      {state.success ? <p className="admin-feedback admin-feedback-success" role="status">{state.success}</p> : null}
    </form>
  );
}

export function OrderNoteForm({ orderId }: { orderId: string }) {
  const [state, action, pending] = useActionState(addOrderNote, {});
  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="admin-field" htmlFor={`order-note-${orderId}`}>
        Quick note
        <textarea id={`order-note-${orderId}`} name="body" rows={2} maxLength={2000} required />
      </label>
      <Feedback state={state} />
      <button className="admin-button admin-button-secondary" type="submit" disabled={pending}>
        {pending ? "Saving…" : "Add note"}
      </button>
    </form>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (state.error) return <p className="admin-feedback admin-feedback-error" role="alert">{state.error}</p>;
  if (state.success) return <p className="admin-feedback admin-feedback-success" role="status">{state.success}</p>;
  return null;
}
