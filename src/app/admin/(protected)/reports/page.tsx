import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/auth/authorization";
import { getMoreReports, getProfitReport } from "@/lib/reports/analytics";
import { getDhakaDate, getPreviousDhakaDate, resolveDhakaDateRange } from "@/lib/reports/date-range";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Sales & operations reports | Crazy Cart" };

const courierNames = { STEADFAST: "Steadfast", PATHAO: "Pathao", REDX: "RedX" } as const;

function money(value: string) {
  return `৳${Number(value).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireStaff(["ADMIN", "MANAGER"]);
  const params = await searchParams;
  const today = getDhakaDate();
  let defaultFrom = today;
  for (let day = 0; day < 29; day += 1) defaultFrom = getPreviousDhakaDate(defaultFrom);
  const resolved = resolveDhakaDateRange(params.from, params.to, defaultFrom, today);
  const [profit, more, allStockTotal] = await Promise.all([
    getProfitReport(resolved.range),
    getMoreReports(resolved.range),
    getPrisma().$queryRaw<Array<{ total: string }>>`
      SELECT COALESCE(SUM(quantity_remaining * unit_cost), 0)::numeric(14, 2)::text AS total
      FROM inventory_batches
      WHERE quantity_remaining > 0
    `,
  ]);
  const courierTotals = new Map<string, { bookings: number; delivered: number; returned: number }>();
  for (const row of more.couriers) {
    const total = courierTotals.get(row.provider) ?? { bookings: 0, delivered: 0, returned: 0 };
    total.bookings += row._count._all;
    if (row.status === "DELIVERED") total.delivered += row._count._all;
    if (row.status === "RETURNED") total.returned += row._count._all;
    courierTotals.set(row.provider, total);
  }

  return (
    <section aria-labelledby="reports-title">
      <div className="admin-page-title-row">
        <div>
          <h1 className="admin-page-heading" id="reports-title">Profit, sales & operations reports</h1>
          <p className="admin-page-intro">Financial and operational summaries for {resolved.range.from} through {resolved.range.to}. Sales and costs are in BDT (৳).</p>
        </div>
        <Link className="admin-button admin-button-secondary" href="/admin/accounting">Accounting</Link>
      </div>
      <form className="admin-panel admin-form" method="get" aria-label="Filter reports by date">
        <div className="admin-form-grid">
          <label className="admin-field" htmlFor="reports-from">From
            <input id="reports-from" name="from" type="date" defaultValue={resolved.range.from} required />
          </label>
          <label className="admin-field" htmlFor="reports-to">To
            <input id="reports-to" name="to" type="date" defaultValue={resolved.range.to} required />
          </label>
        </div>
        <button className="admin-button" type="submit">Run reports</button>
      </form>
      {resolved.error ? <p className="admin-feedback admin-feedback-error" role="alert">{resolved.error}</p> : null}

      <section className="admin-panel" aria-labelledby="profit-sales-title">
        <h2 id="profit-sales-title">Profit & sales</h2>
        <p>Sales include orders that entered Delivered during this period. COGS uses recorded FIFO batch allocations; other income excludes COD remittance to avoid counting the order sale twice.</p>
        <div className="admin-table-scroll">
          <table className="admin-data-table">
            <caption>Profit and sales summary for the selected period</caption>
            <tbody>
              <tr><th scope="row">Delivered sales</th><td>{money(profit.deliveredSales)}</td></tr>
              <tr><th scope="row">Cost of goods sold (FIFO)</th><td>{money(profit.costOfGoods)}</td></tr>
              <tr><th scope="row">Gross profit estimate</th><td>{money(profit.grossProfit)}</td></tr>
              <tr><th scope="row">Gross margin estimate</th><td>{profit.grossMarginPercent}%</td></tr>
              <tr><th scope="row">Other recorded income</th><td>{money(profit.otherIncome)}</td></tr>
              <tr><th scope="row">Recorded expenses</th><td>{money(profit.expenses)}</td></tr>
              <tr><th scope="row">Net profit estimate</th><td><strong>{money(profit.netProfit)}</strong></td></tr>
            </tbody>
          </table>
        </div>
        {profit.uncostedPhysicalItems ? (
          <p className="admin-feedback admin-feedback-error" role="status">
            FIFO cost is missing for {profit.uncostedPhysicalItems} delivered physical unit(s). Profit and margin are estimates and may be overstated.
          </p>
        ) : <p className="admin-feedback admin-feedback-success" role="status">Delivered physical units are fully costed from FIFO batch allocations.</p>}
      </section>

      <section className="admin-panel" aria-labelledby="stock-valuation-title">
        <h2 id="stock-valuation-title">Stock valuation</h2>
        <p>Current on-hand inventory is valued at the cost of its remaining FIFO batches; this is a current snapshot, not a historical valuation.</p>
        <p className="dashboard-kpi-value">Total stock value: {money(allStockTotal[0]?.total ?? "0.00")}</p>
        {more.stock.length ? (
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <caption>Top 50 product and warehouse groups by FIFO stock value</caption>
              <thead><tr><th scope="col">Warehouse</th><th scope="col">Product</th><th scope="col">Units on hand</th><th scope="col">FIFO value</th></tr></thead>
              <tbody>
                {more.stock.map((row, index) => (
                  <tr key={`${row.warehouse}-${row.product}-${index}`}>
                    <td>{row.warehouse}</td>
                    <th scope="row">{row.product}</th>
                    <td>{row.quantity.toLocaleString("en-BD")}</td>
                    <td>{money(row.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p>No on-hand inventory has a remaining FIFO batch.</p>}
      </section>

      <section className="admin-panel" aria-labelledby="customer-performance-title">
        <h2 id="customer-performance-title">Customer performance</h2>
        <p>Top customers by delivered order value; order placement date is used for this period filter.</p>
        {more.customers.length ? (
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <caption>Top customers with delivered sales in the selected period</caption>
              <thead><tr><th scope="col">Customer</th><th scope="col">Phone</th><th scope="col">Delivered orders</th><th scope="col">Sales</th></tr></thead>
              <tbody>
                {more.customers.map((customer) => (
                  <tr key={customer.id}>
                    <th scope="row">{customer.name}</th>
                    <td>{customer.phone}</td>
                    <td>{customer.orders}</td>
                    <td>{money(customer.deliveredSales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p>No customer deliveries match this period.</p>}
      </section>

      <section className="admin-panel" aria-labelledby="courier-performance-title">
        <h2 id="courier-performance-title">Courier performance</h2>
        {courierTotals.size ? (
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <caption>Courier booking outcomes created in the selected period</caption>
              <thead><tr><th scope="col">Courier</th><th scope="col">Bookings</th><th scope="col">Delivered</th><th scope="col">Returned</th><th scope="col">Delivery rate</th></tr></thead>
              <tbody>
                {[...courierTotals.entries()].map(([provider, totals]) => (
                  <tr key={provider}>
                    <th scope="row">{courierNames[provider as keyof typeof courierNames]}</th>
                    <td>{totals.bookings}</td>
                    <td>{totals.delivered}</td>
                    <td>{totals.returned}</td>
                    <td>{totals.bookings ? `${(totals.delivered / totals.bookings * 100).toFixed(1)}%` : "0.0%"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p>No courier bookings match this period.</p>}
      </section>

      <section className="admin-panel" aria-labelledby="report-scope-title">
        <h2 id="report-scope-title">Report notes</h2>
        <ul className="admin-plain-list">
          <li>Gross profit subtracts FIFO costs allocated to delivered physical order items. Digital item costs are not tracked in the current inventory model.</li>
          <li>Net profit subtracts recorded expenses and adds non-courier ledger income; unrecorded costs and taxes are not estimated.</li>
          <li>Courier delivery rates are based on bookings entered into the system; live provider integration is not configured.</li>
        </ul>
      </section>
    </section>
  );
}
