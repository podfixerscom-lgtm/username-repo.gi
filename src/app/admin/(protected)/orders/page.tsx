import Link from "next/link";
import type { Metadata } from "next";
import type { OrderSource, OrderStatus } from "@/generated/prisma/client";
import { requireStaff } from "@/auth/authorization";
import { getPrisma } from "@/lib/prisma";
import { OrderNoteForm, OrderStatusControls } from "./order-forms";

export const metadata: Metadata = { title: "অর্ডার | Crazy Cart Operations" };

const statusLabels: Record<OrderStatus, string> = {
  PENDING: "অপেক্ষমাণ",
  AWAITING_PAYMENT: "পেমেন্টের অপেক্ষায়",
  CONFIRMED: "নিশ্চিত",
  PROCESSING: "প্রক্রিয়াধীন",
  PACKED: "প্যাক করা",
  SHIPPED: "কুরিয়ারে পাঠানো",
  DELIVERED: "ডেলিভারড",
  RETURNED: "রিটার্ন",
  CANCELLED: "বাতিল",
};

const sourceLabels: Record<OrderSource, string> = {
  WEB: "ওয়েব",
  FACEBOOK: "Facebook",
  PHONE: "ফোন",
  POS: "POS",
};

const paymentLabels = {
  COD: "ক্যাশ অন ডেলিভারি",
  CASH: "নগদ",
  BKASH: "bKash",
  NAGAD: "Nagad",
  SSLCOMMERZ: "SSLCommerz",
} as const;

const statuses = Object.keys(statusLabels) as OrderStatus[];
const sources = Object.keys(sourceLabels) as OrderSource[];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source?: string; q?: string }>;
}) {
  await requireStaff();
  const filters = await searchParams;
  const status = statuses.find((item) => item === filters.status);
  const source = sources.find((item) => item === filters.source);
  const query = filters.q?.trim().slice(0, 80) ?? "";
  const orders = await getPrisma().order.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
      ...(query ? {
        OR: [
          { orderNumber: { contains: query, mode: "insensitive" } },
          { customerName: { contains: query, mode: "insensitive" } },
          { customerPhone: { contains: query } },
        ],
      } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: { digitalAssets: { select: { assetId: true } } },
      },
      notes: {
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { author: { select: { name: true, email: true } } },
      },
      courierBookings: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return (
    <section aria-labelledby="orders-title">
      <h1 className="admin-page-heading" id="orders-title">অর্ডার ও অপারেশনস</h1>
      <p className="admin-page-intro">অর্ডার প্রসেসিং, quick notes, order source এবং invoice/label পরিচালনা করুন।</p>
      <div className="admin-actions">
        <Link className="admin-button admin-button-secondary" href="/admin/orders/scan">Order scan / packing</Link>
        <Link className="admin-button admin-button-secondary" href="/admin/pos">POS ও offline queue</Link>
        <Link className="admin-button admin-button-secondary" href="/admin/purchases">Purchases</Link>
        <Link className="admin-button admin-button-secondary" href="/admin/customers">Customers / fraud history</Link>
      </div>

      <form className="admin-panel admin-form" method="get" aria-label="অর্ডার খুঁজুন">
        <div className="admin-form-grid">
          <label className="admin-field" htmlFor="orders-search-query">Order / customer
            <input id="orders-search-query" name="q" maxLength={80} defaultValue={query} />
          </label>
          <label className="admin-field" htmlFor="orders-search-status">Status
            <select id="orders-search-status" name="status" defaultValue={status ?? ""}>
              <option value="">সব status</option>
              {statuses.map((item) => <option value={item} key={item}>{statusLabels[item]}</option>)}
            </select>
          </label>
          <label className="admin-field" htmlFor="orders-search-source">Source
            <select id="orders-search-source" name="source" defaultValue={source ?? ""}>
              <option value="">সব source</option>
              {sources.map((item) => <option value={item} key={item}>{sourceLabels[item]}</option>)}
            </select>
          </label>
        </div>
        <button className="admin-button" type="submit">Search orders</button>
      </form>

      {orders.length ? (
        <div className="admin-stack">
          {orders.map((order) => {
            const booking = order.courierBookings[0];
            return (
              <article className="admin-panel" key={order.id}>
                <div className="admin-page-title-row">
                  <h2>{order.orderNumber}</h2>
                  <time dateTime={order.createdAt.toISOString()}>
                    {order.createdAt.toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}
                  </time>
                </div>
                <dl className="admin-inline-details">
                  <div><dt>অবস্থা</dt><dd>{statusLabels[order.status]}</dd></div>
                  <div><dt>Source</dt><dd>{sourceLabels[order.source]}</dd></div>
                  <div><dt>পেমেন্ট</dt><dd>{paymentLabels[order.paymentMethod]} · {order.paymentState}</dd></div>
                  <div><dt>গ্রাহক</dt><dd>{order.customerName} · {order.customerPhone || "Walk-in"}</dd></div>
                  <div><dt>মোট</dt><dd>৳{order.total.toFixed(2)}</dd></div>
                  <div><dt>শিপিং</dt><dd>৳{order.shippingCharge.toFixed(2)}</dd></div>
                  {booking ? (
                    <div><dt>কুরিয়ার</dt><dd>{booking.provider} · {booking.status} · {booking.trackingNumber ?? booking.consignmentId ?? "tracking pending"}</dd></div>
                  ) : null}
                  {order.hasPreorder ? <div><dt>Inventory</dt><dd>স্টক নিশ্চিত না হওয়া পর্যন্ত Pending</dd></div> : null}
                  <div className="admin-field-wide">
                    <dt>পণ্য</dt>
                    <dd>{order.items.map((item) =>
                      `${item.productName} (${item.sku}) × ${item.quantity} · reserved ${item.reservedQuantity}${item.digitalAssets.length ? ` · ${item.digitalAssets.length} license key reserved` : ""}${item.isPreorder ? " · pre-order" : ""}`,
                    ).join("; ")}</dd>
                  </div>
                  <div className="admin-field-wide"><dt>ঠিকানা</dt><dd>{order.address}{order.area ? `, ${order.area}` : ""}, {order.city}</dd></div>
                </dl>
                <div className="admin-actions">
                  <Link className="admin-text-link" href={`/admin/orders/${order.id}/print?view=invoice`}>Invoice print view</Link>
                  <Link className="admin-text-link" href={`/admin/orders/${order.id}/print?view=label`}>Sticker label</Link>
                  {order.customerId ? <Link className="admin-text-link" href={`/admin/customers/${order.customerId}`}>Customer history</Link> : null}
                </div>
                <OrderStatusControls orderId={order.id} status={order.status} />
                <OrderNoteForm orderId={order.id} />
                {order.notes.length ? (
                  <ul className="admin-plain-list">
                    {order.notes.map((note) => (
                      <li className="admin-history-item" key={note.id}>
                        <span>{note.body}</span>
                        <small>{note.author?.name ?? note.author?.email ?? "Staff"} · {note.createdAt.toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}</small>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : <div className="admin-panel"><p>এই filter-এ কোনো অর্ডার নেই।</p></div>}
    </section>
  );
}
