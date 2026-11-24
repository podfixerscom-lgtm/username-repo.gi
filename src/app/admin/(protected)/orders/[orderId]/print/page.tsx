import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireStaff } from "@/auth/authorization";
import { getPrisma } from "@/lib/prisma";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Order print view | Crazy Cart Operations" };

export default async function OrderPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  await requireStaff();
  const [{ orderId }, { view }] = await Promise.all([params, searchParams]);
  const mode = view === "label" ? "label" : "invoice";
  const order = await getPrisma().order.findUnique({
    where: { id: orderId },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      courierBookings: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!order) notFound();

  return (
    <section className="admin-print-page" aria-labelledby="print-order-title">
      <div className="admin-actions admin-print-controls">
        <Link className="admin-text-link" href="/admin/orders">Back to orders</Link>
        <PrintButton />
      </div>
      {mode === "label" ? (
        <article className="admin-panel admin-shipping-label">
          <p>CRAZY CART · {order.source}</p>
          <h1 id="print-order-title">{order.orderNumber}</h1>
          <h2>{order.customerName}</h2>
          <p className="admin-label-phone">{order.customerPhone || "Walk-in"}</p>
          <p>{order.address}{order.area ? `, ${order.area}` : ""}, {order.city}</p>
          <p>{order.deliveryZone ?? "Counter sale"} · {order.courierBookings[0]?.trackingNumber ?? ""}</p>
        </article>
      ) : (
        <article className="admin-panel admin-invoice">
          <p>Crazy Cart · Everything you need, at crazy speed.</p>
          <h1 id="print-order-title">Invoice {order.orderNumber}</h1>
          <dl className="admin-inline-details">
            <div><dt>তারিখ</dt><dd>{order.createdAt.toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}</dd></div>
            <div><dt>Source / status</dt><dd>{order.source} · {order.status}</dd></div>
            <div><dt>Customer</dt><dd>{order.customerName} · {order.customerPhone || "Walk-in"}</dd></div>
            <div><dt>ঠিকানা</dt><dd>{order.address}{order.area ? `, ${order.area}` : ""}, {order.city}</dd></div>
          </dl>
          <table className="admin-invoice-table">
            <thead>
              <tr><th>পণ্য</th><th>SKU</th><th>পরিমাণ</th><th>একক মূল্য</th><th>মোট</th></tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.productName}</td>
                  <td>{item.sku}</td>
                  <td>{item.quantity}</td>
                  <td>৳{item.unitPrice.toFixed(2)}</td>
                  <td>৳{item.lineTotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="admin-invoice-totals">
            <div><dt>Subtotal</dt><dd>৳{order.subtotal.toFixed(2)}</dd></div>
            <div><dt>Discount</dt><dd>৳{order.discountAmount.toFixed(2)}</dd></div>
            <div><dt>Delivery</dt><dd>৳{order.shippingCharge.toFixed(2)}</dd></div>
            <div><dt>Total</dt><dd>৳{order.total.toFixed(2)}</dd></div>
          </dl>
          <p>Payment: {order.paymentMethod} · {order.paymentState}</p>
        </article>
      )}
    </section>
  );
}
