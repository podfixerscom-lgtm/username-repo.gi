import type { Metadata } from "next";
import { requireStaff } from "@/auth/authorization";
import { getPrisma } from "@/lib/prisma";
import { PurchaseOrderForm, ReceivePurchaseItemForm, SupplierForm } from "./forms";

export const metadata: Metadata = { title: "Purchases | Crazy Cart Operations" };

export default async function PurchasesPage() {
  await requireStaff();
  const prisma = getPrisma();
  const [suppliers, variants, warehouses, orders] = await Promise.all([
    prisma.supplier.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, email: true },
    }),
    prisma.productVariant.findMany({
      where: { isActive: true, product: { isActive: true, type: "PHYSICAL" } },
      orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
      select: { id: true, sku: true, name: true, product: { select: { name: true } } },
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.purchaseOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        supplier: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
        items: {
          include: {
            variant: { select: { sku: true, name: true, product: { select: { name: true } } } },
          },
        },
      },
    }),
  ]);
  const variantOptions = variants.map((variant) => ({
    id: variant.id,
    label: `${variant.product.name} · ${variant.name ? `${variant.name} · ` : ""}${variant.sku}`,
  }));

  return (
    <section aria-labelledby="purchases-title">
      <h1 className="admin-page-heading" id="purchases-title">Purchases & stock receiving</h1>
      <p className="admin-page-intro">Purchase orders are tracked by supplier; received quantities create costed FIFO batches and stock audit entries.</p>

      <section className="admin-panel" aria-labelledby="supplier-title">
        <h2 id="supplier-title">Suppliers</h2>
        {suppliers.length ? (
          <ul className="admin-inline-list">
            {suppliers.map((supplier) => (
              <li key={supplier.id}><strong>{supplier.name}</strong><br />{supplier.phone ?? "No phone"}{supplier.email ? ` · ${supplier.email}` : ""}</li>
            ))}
          </ul>
        ) : <p>No suppliers yet.</p>}
        <h3 className="admin-subsection-heading">Add supplier</h3>
        <SupplierForm />
      </section>

      <section className="admin-panel" aria-labelledby="purchase-create-title">
        <h2 id="purchase-create-title">Create purchase order</h2>
        {suppliers.length && variantOptions.length ? (
          <PurchaseOrderForm suppliers={suppliers.map(({ id, name }) => ({ id, name }))} variants={variantOptions} />
        ) : <p>Add an active supplier and physical product variant before creating a purchase order.</p>}
      </section>

      <section className="admin-panel" aria-labelledby="purchase-list-title">
        <h2 id="purchase-list-title">Recent purchase orders</h2>
        {orders.length ? (
          <div className="admin-stack">
            {orders.map((order) => (
              <article className="admin-subpanel" key={order.id}>
                <h3>PO-{order.id.slice(-8).toUpperCase()} · {order.supplier.name} · {order.status}</h3>
                <p>Created by {order.createdBy.name ?? order.createdBy.email} · {order.createdAt.toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}</p>
                {order.note ? <p>{order.note}</p> : null}
                <div className="admin-stack">
                  {order.items.map((item) => {
                    const remaining = item.quantityOrdered - item.quantityReceived;
                    return (
                      <div className="admin-history-item" key={item.id}>
                        <strong>{item.variant.product.name} · {item.variant.name ? `${item.variant.name} · ` : ""}{item.variant.sku}</strong>
                        <span>Ordered {item.quantityOrdered} · received {item.quantityReceived} · unit cost ৳{item.unitCost.toFixed(2)}</span>
                        <ReceivePurchaseItemForm
                          itemId={item.id}
                          maxQuantity={remaining}
                          warehouses={warehouses}
                        />
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        ) : <p>No purchase orders yet.</p>}
      </section>
    </section>
  );
}
