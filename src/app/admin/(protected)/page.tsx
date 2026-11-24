import Link from "next/link";
import type { Metadata } from "next";
import type { OrderStatus } from "@/generated/prisma/client";
import { requireStaff } from "@/auth/authorization";
import { getDashboardAnalytics } from "@/lib/reports/analytics";
import { getDhakaDate, resolveDhakaDateRange } from "@/lib/reports/date-range";
import { DashboardControls } from "./dashboard-controls";
import { HourlyWebOrdersChart, OrderVolumeChart } from "./analytics-charts";

export const metadata: Metadata = { title: "Operations dashboard | Crazy Cart" };

const orderStatuses: OrderStatus[] = [
  "PENDING",
  "AWAITING_PAYMENT",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "RETURNED",
  "CANCELLED",
];

const sourceLabels = {
  WEB: "Web",
  FACEBOOK: "Facebook",
  PHONE: "Phone",
  POS: "POS",
} as const;

function money(value: string) {
  return `৳${Number(value).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function OperationsHome({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string }>;
}) {
  const user = await requireStaff();
  const params = await searchParams;
  const today = getDhakaDate();
  const resolved = resolveDhakaDateRange(params.from, params.to, today, today);
  const selectedStatus = orderStatuses.find((status) => status === params.status);
  const statusError = params.status && !selectedStatus
    ? "Order status filter is invalid; all statuses are shown."
    : undefined;
  const analytics = await getDashboardAnalytics({
    range: resolved.range,
    status: selectedStatus,
  });
  const canManageFinance = user.role === "ADMIN" || user.role === "MANAGER";
  const filterDescription = [
    selectedStatus ?? "All orders",
    resolved.range.from === resolved.range.to
      ? resolved.range.from
      : `${resolved.range.from} to ${resolved.range.to}`,
  ].join(" · ");

  return (
    <section aria-labelledby="dashboard-title">
      <div className="admin-page-title-row">
        <div>
          <h1 className="admin-page-heading" id="dashboard-title">Crazy Cart overview</h1>
          <p className="admin-page-intro">Welcome, {user.name ?? user.email}. {filterDescription} · amounts in BDT (৳).</p>
        </div>
        <div className="admin-actions">
          <Link className="admin-button admin-button-secondary" href="/admin/orders">Open orders</Link>
          <Link className="admin-button admin-button-secondary" href="/admin/reports">Sales & more reports</Link>
          {canManageFinance ? <Link className="admin-button admin-button-secondary" href="/admin/accounting">Accounting</Link> : null}
        </div>
      </div>

      <DashboardControls from={resolved.range.from} to={resolved.range.to} status={selectedStatus} />
      {resolved.error || statusError ? (
        <p className="admin-feedback admin-feedback-error" role="alert">{resolved.error ?? statusError}</p>
      ) : null}

      <section className="dashboard-kpi-grid" aria-label="Order key performance indicators">
        <article className="admin-panel">
          <h2>Orders</h2>
          <p className="dashboard-kpi-value">{analytics.metrics.orders.toLocaleString("en-BD")}</p>
          <p>Orders placed in the selected range and status.</p>
        </article>
        <article className="admin-panel">
          <h2>Booked sales</h2>
          <p className="dashboard-kpi-value">{money(analytics.metrics.bookedSales)}</p>
          <p>Confirmed through delivered orders; excludes pending, unpaid, returned, and cancelled.</p>
        </article>
        <article className="admin-panel">
          <h2>Delivered sales</h2>
          <p className="dashboard-kpi-value">{money(analytics.metrics.deliveredSales)}</p>
          <p>Orders currently marked delivered.</p>
        </article>
        <article className="admin-panel">
          <h2>Estimate from orders</h2>
          <p className="dashboard-kpi-value">{money(analytics.metrics.estimate)}</p>
          <p>Non-cancelled and non-returned order value, including pending and awaiting payment.</p>
        </article>
      </section>

      <section className={`admin-panel dashboard-attention${analytics.attention.allCaughtUp ? " dashboard-attention-clear" : ""}`} aria-labelledby="attention-title">
        <div className="admin-page-title-row">
          <h2 id="attention-title">Needs attention</h2>
          {analytics.attention.allCaughtUp ? (
            <p className="admin-feedback admin-feedback-success" role="status">All caught up</p>
          ) : (
            <p className="admin-feedback admin-feedback-error" role="status">Review the outstanding items below.</p>
          )}
        </div>
        {analytics.attention.allCaughtUp ? (
          <p>No pending orders, failed courier bookings, or delivered COD remittances are waiting for action.</p>
        ) : (
          <ul className="admin-inline-list">
            {analytics.attention.pendingOrders ? (
              <li><strong>{analytics.attention.pendingOrders} orders need confirmation or payment</strong><Link className="admin-text-link" href="/admin/orders">Review orders</Link></li>
            ) : null}
            {analytics.attention.failedBookings ? (
              <li><strong>{analytics.attention.failedBookings} courier bookings failed</strong><Link className="admin-text-link" href="/admin/orders">Review courier bookings</Link></li>
            ) : null}
            {analytics.attention.unsettledCod ? (
              <li>
                <strong>{analytics.attention.unsettledCod} delivered COD remittances are unreconciled</strong>
                <Link className="admin-text-link" href={canManageFinance ? "/admin/accounting/courier" : "/admin/orders"}>Review COD orders</Link>
              </li>
            ) : null}
          </ul>
        )}
      </section>

      <OrderVolumeChart data={analytics.volume} />
      <HourlyWebOrdersChart data={analytics.hourly} />

      <section className="admin-panel" aria-labelledby="source-report-title">
        <h2 id="source-report-title">Web orders & source report</h2>
        {analytics.sources.length ? (
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <caption>Order count and total value by order source</caption>
              <thead><tr><th scope="col">Source</th><th scope="col">Orders</th><th scope="col">Order value</th></tr></thead>
              <tbody>
                {analytics.sources.map((row) => (
                  <tr key={row.source}>
                    <th scope="row">{sourceLabels[row.source]}</th>
                    <td>{row.orders.toLocaleString("en-BD")}</td>
                    <td>{money(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p>No orders match the selected filters.</p>}
      </section>

      <section className="admin-panel" aria-labelledby="subscription-usage-title">
        <h2 id="subscription-usage-title">Subscription & plan usage</h2>
        <p><strong>Subscription not configured.</strong> Crazy Cart is running as a single-store installation; no billing plan or quota limits are connected.</p>
        <dl className="admin-inline-details">
          <div><dt>Active products</dt><dd>{analytics.usage.products.toLocaleString("en-BD")}</dd></div>
          <div><dt>Active staff accounts</dt><dd>{analytics.usage.staff.toLocaleString("en-BD")}</dd></div>
          <div><dt>Active warehouses</dt><dd>{analytics.usage.warehouses.toLocaleString("en-BD")}</dd></div>
        </dl>
      </section>
    </section>
  );
}
