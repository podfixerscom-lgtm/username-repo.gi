"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@/generated/prisma/client";

const statusOptions: Array<{ value: OrderStatus; label: string }> = [
  { value: "PENDING", label: "Pending" },
  { value: "AWAITING_PAYMENT", label: "Awaiting payment" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "PROCESSING", label: "Processing" },
  { value: "PACKED", label: "Packed" },
  { value: "SHIPPED", label: "Shipped" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "RETURNED", label: "Returned" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function DashboardControls({
  from,
  to,
  status,
}: {
  from: string;
  to: string;
  status?: OrderStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="admin-dashboard-controls">
      <form className="admin-panel admin-form" method="get" aria-label="Filter dashboard analytics">
        <div className="admin-form-grid">
          <label className="admin-field" htmlFor="dashboard-from">From
            <input id="dashboard-from" name="from" type="date" defaultValue={from} required />
          </label>
          <label className="admin-field" htmlFor="dashboard-to">To
            <input id="dashboard-to" name="to" type="date" defaultValue={to} required />
          </label>
          <label className="admin-field" htmlFor="dashboard-status">Order status
            <select id="dashboard-status" name="status" defaultValue={status ?? ""}>
              <option value="">All orders</option>
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <div className="admin-actions">
          <button className="admin-button" type="submit">Apply filters</button>
          <button
            className="admin-button admin-button-secondary"
            type="button"
            onClick={() => startTransition(() => router.refresh())}
            disabled={pending}
          >
            {pending ? "Refreshing…" : "Refresh data"}
          </button>
        </div>
      </form>
    </div>
  );
}
