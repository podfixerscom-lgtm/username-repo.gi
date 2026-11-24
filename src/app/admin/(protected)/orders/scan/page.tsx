import type { Metadata } from "next";
import { requireStaff } from "@/auth/authorization";
import { getPrisma } from "@/lib/prisma";
import { OrderStatusControls } from "../order-forms";

export const metadata: Metadata = { title: "Order Scan | Crazy Cart Operations" };

export default async function OrderScanPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  await requireStaff();
  const { code = "" } = await searchParams;
  const query = code.trim().slice(0, 80);
  const order = query
    ? await getPrisma().order.findFirst({
      where: { OR: [{ orderNumber: query }, { id: query }] },
      include: {
        items: { orderBy: { createdAt: "asc" } },
        statusHistory: {
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { author: { select: { name: true, email: true } } },
        },
      },
    })
    : null;

  return (
    <section aria-labelledby="order-scan-title">
      <h1 className="admin-page-heading" id="order-scan-title">Order scan & packing</h1>
      <p className="admin-page-intro">Barcode scanner-এর কোড বা order number লিখে Enter চাপুন; scanner keyboard input হিসেবেও কাজ করবে।</p>
      <form className="admin-panel admin-form" method="get">
        <label className="admin-field" htmlFor="order-code">Order code
          <input id="order-code" name="code" autoComplete="off" autoFocus maxLength={80} defaultValue={query} />
        </label>
        <button className="admin-button" type="submit">Find order</button>
      </form>

      {query && !order ? <p className="admin-feedback admin-feedback-error" role="alert">এই order code পাওয়া যায়নি।</p> : null}
      {order ? (
        <article className="admin-panel">
          <h2>{order.orderNumber}</h2>
          <p>বর্তমান অবস্থা: <strong>{order.status}</strong> · {order.customerName} · {order.customerPhone || "Walk-in"}</p>
          <ul className="admin-plain-list">
            {order.items.map((item) => (
              <li className="admin-history-item" key={item.id}>
                <strong>{item.productName} · {item.sku}</strong>
                <span>পরিমাণ {item.quantity} · reserved {item.reservedQuantity}</span>
              </li>
            ))}
          </ul>
          <OrderStatusControls orderId={order.id} status={order.status} />
          <h3 className="admin-subsection-heading">সাম্প্রতিক status history</h3>
          {order.statusHistory.length ? (
            <ol className="admin-plain-list">
              {order.statusHistory.map((entry) => (
                <li className="admin-history-item" key={entry.id}>
                  <strong>{entry.fromStatus ?? "NEW"} → {entry.toStatus}</strong>
                  {entry.note ? <span>{entry.note}</span> : null}
                  <small>{entry.author?.name ?? entry.author?.email ?? "System"} · {entry.createdAt.toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}</small>
                </li>
              ))}
            </ol>
          ) : <p>কোনো status history নেই।</p>}
        </article>
      ) : null}
    </section>
  );
}
