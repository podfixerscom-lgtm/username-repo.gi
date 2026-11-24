import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/auth/authorization";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Customers | Crazy Cart Operations" };

export default async function CustomersPage() {
  await requireStaff();
  const customers = await getPrisma().customer.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: {
      _count: { select: { orders: true } },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, total: true, status: true },
      },
    },
  });

  return (
    <section aria-labelledby="customers-title">
      <h1 className="admin-page-heading" id="customers-title">Customers & marketing history</h1>
      <p className="admin-page-intro">Customer profiles are linked by normalized phone number. Marketing consent remains off unless separately recorded.</p>
      {customers.length ? (
        <ul className="admin-card-grid">
          {customers.map((customer) => {
            const lastOrder = customer.orders[0];
            return (
              <li className="admin-panel" key={customer.id}>
                <h2><Link className="admin-text-link" href={`/admin/customers/${customer.id}`}>{customer.name}</Link></h2>
                <p>{customer.phone}{customer.email ? ` · ${customer.email}` : ""}</p>
                <p>{customer._count.orders} orders · Marketing: {customer.marketingConsent ? "Opted in" : "Not opted in"}</p>
                {lastOrder ? (
                  <p>Last order: {lastOrder.status} · ৳{lastOrder.total.toFixed(2)} · {lastOrder.createdAt.toLocaleDateString("bn-BD", { timeZone: "Asia/Dhaka" })}</p>
                ) : null}
                <Link className="admin-text-link" href={`/admin/customers/${customer.id}`}>Open profile & history</Link>
              </li>
            );
          })}
        </ul>
      ) : <div className="admin-panel"><p>No customer profiles yet. Profiles are created when orders are placed.</p></div>}
    </section>
  );
}
