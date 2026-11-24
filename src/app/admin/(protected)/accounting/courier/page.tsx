import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/auth/authorization";
import { getPrisma } from "@/lib/prisma";
import { CourierSettlementForm } from "../forms";

export const metadata: Metadata = { title: "Courier COD reconciliation | Crazy Cart Operations" };

function money(value: { toFixed: (digits: number) => string }) {
  return `৳${Number(value.toFixed(2)).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function CourierReconciliationPage() {
  await requireStaff(["ADMIN", "MANAGER"]);
  const prisma = getPrisma();
  const [accounts, pendingBookings, settlements] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true },
    }),
    prisma.courierBooking.findMany({
      where: {
        status: "DELIVERED",
        settlement: { is: null },
        order: { is: { status: "DELIVERED", paymentMethod: "COD" } },
      },
      orderBy: { bookedAt: "desc" },
      take: 100,
      include: { order: { select: { orderNumber: true, total: true } } },
    }),
    prisma.courierSettlement.findMany({
      orderBy: { reconciledAt: "desc" },
      take: 100,
      include: {
        booking: { select: { provider: true, order: { select: { orderNumber: true } } } },
        account: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
      },
    }),
  ]);

  return (
    <section aria-labelledby="courier-reconciliation-title">
      <Link className="admin-back-link" href="/admin/accounting">Back to accounting</Link>
      <h1 className="admin-page-heading" id="courier-reconciliation-title">Courier COD reconciliation</h1>
      <p className="admin-page-intro">Match delivered COD bookings to courier remittances. Enter the gross amount before fees; the fee is posted as an expense in the same receiving account.</p>

      <section className="admin-panel" aria-labelledby="pending-cod-title">
        <h2 id="pending-cod-title">Delivered COD bookings awaiting reconciliation</h2>
        {pendingBookings.length ? (
          <div className="admin-stack">
            {pendingBookings.map((booking) => (
              <article className="admin-subpanel" key={booking.id}>
                <h3>{booking.order.orderNumber} · {booking.provider}</h3>
                <p>Expected COD: {money(booking.order.total)} · Last booking update {booking.updatedAt.toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })}</p>
                <CourierSettlementForm
                  booking={{
                    id: booking.id,
                    orderNumber: booking.order.orderNumber,
                    provider: booking.provider,
                    expectedCod: booking.order.total.toFixed(2),
                  }}
                  accounts={accounts}
                />
              </article>
            ))}
          </div>
        ) : <p>No delivered COD bookings are waiting for reconciliation.</p>}
      </section>

      <section className="admin-panel" aria-labelledby="reconciled-cod-title">
        <h2 id="reconciled-cod-title">Recent reconciliations</h2>
        {settlements.length ? (
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <caption>Recent courier COD remittances posted to the ledger</caption>
              <thead><tr><th scope="col">Date</th><th scope="col">Order</th><th scope="col">Courier</th><th scope="col">Expected COD</th><th scope="col">Gross received</th><th scope="col">Courier fee</th><th scope="col">Net received</th><th scope="col">Account</th><th scope="col">Recorded by</th></tr></thead>
              <tbody>
                {settlements.map((settlement) => (
                  <tr key={settlement.id}>
                    <td>{settlement.reconciledAt?.toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" }) ?? "—"}</td>
                    <th scope="row">{settlement.booking.order.orderNumber}</th>
                    <td>{settlement.booking.provider}</td>
                    <td>{money(settlement.expectedCod)}</td>
                    <td>{money(settlement.receivedAmount)}</td>
                    <td>{money(settlement.courierFee)}</td>
                    <td>{money(settlement.receivedAmount.minus(settlement.courierFee))}</td>
                    <td>{settlement.account.name}</td>
                    <td>{settlement.createdBy.name ?? settlement.createdBy.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p>No courier COD reconciliations yet.</p>}
      </section>
    </section>
  );
}
