import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireStaff } from "@/auth/authorization";
import { getPrisma } from "@/lib/prisma";
import { FraudHistoryCheckForm } from "../fraud-check-form";

export const metadata: Metadata = { title: "Customer history | Crazy Cart Operations" };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  await requireStaff();
  const { customerId } = await params;
  const customer = await getPrisma().customer.findUnique({
    where: { id: customerId },
    include: {
      _count: { select: { orders: true } },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          items: { orderBy: { createdAt: "asc" } },
          fraudChecks: {
            orderBy: { createdAt: "desc" },
            include: { checkedBy: { select: { name: true, email: true } } },
          },
        },
      },
    },
  });
  if (!customer) notFound();

  const returnedCount = customer.orders.filter((order) => order.status === "RETURNED").length;
  const cancelledCount = customer.orders.filter((order) => order.status === "CANCELLED").length;
  const totalSpend = customer.orders
    .filter((order) => order.status === "DELIVERED")
    .reduce((sum, order) => sum + Number(order.total), 0);

  return (
    <section aria-labelledby="customer-title">
      <Link className="admin-back-link" href="/admin/customers">← Customers</Link>
      <h1 className="admin-page-heading" id="customer-title">{customer.name}</h1>
      <div className="admin-panel">
        <dl className="admin-inline-details">
          <div><dt>Phone</dt><dd>{customer.phone}</dd></div>
          <div><dt>Email</dt><dd>{customer.email ?? "Not provided"}</dd></div>
          <div><dt>Marketing consent</dt><dd>{customer.marketingConsent ? "Opted in" : "Not opted in"}</dd></div>
          <div><dt>Orders</dt><dd>{customer._count.orders} · Delivered spend in latest 100 ৳{totalSpend.toFixed(2)}</dd></div>
          <div><dt>Returns / cancellations</dt><dd>{returnedCount} returned · {cancelledCount} cancelled in latest 100</dd></div>
        </dl>
        <FraudHistoryCheckForm customerId={customer.id} />
      </div>

      <section className="admin-panel" aria-labelledby="customer-orders-title">
        <h2 id="customer-orders-title">Order history</h2>
        {customer.orders.length ? (
          <div className="admin-stack">
            {customer.orders.map((order) => (
              <article className="admin-subpanel" key={order.id}>
                <div className="admin-page-title-row">
                  <h3><Link className="admin-text-link" href={`/admin/orders/${order.id}/print?view=invoice`}>{order.orderNumber}</Link></h3>
                  <time dateTime={order.createdAt.toISOString()}>{order.createdAt.toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}</time>
                </div>
                <p>{order.status} · {order.source} · {order.paymentMethod} / {order.paymentState} · ৳{order.total.toFixed(2)}</p>
                <ul className="admin-plain-list">
                  {order.items.map((item) => (
                    <li className="admin-history-item" key={item.id}>
                      {item.productName} · {item.sku} × {item.quantity}
                    </li>
                  ))}
                </ul>
                {order.fraudChecks.map((check) => (
                  <p className="admin-status-note" key={check.id}>
                    {check.provider} · {check.riskLevel}: {check.summary} · {check.checkedBy?.name ?? check.checkedBy?.email ?? "System"}
                  </p>
                ))}
              </article>
            ))}
          </div>
        ) : <p>No order history.</p>}
      </section>
    </section>
  );
}
