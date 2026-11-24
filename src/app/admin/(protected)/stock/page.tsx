import type { Metadata } from "next";
import { requireStaff } from "@/auth/authorization";
import { getPrisma } from "@/lib/prisma";
import { StockAdjustmentForm, StockTransferForm, WarehouseForm } from "./stock-forms";

export const metadata: Metadata = { title: "স্টক টুলস | Crazy Cart Operations" };

export default async function StockToolsPage() {
  const user = await requireStaff();
  const canManageWarehouses = user.role !== "STAFF";
  const prisma = getPrisma();
  const [variants, warehouses, adjustments, transfers] = await Promise.all([
    prisma.productVariant.findMany({
      where: { isActive: true, product: { isActive: true } },
      orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
      select: {
        id: true,
        sku: true,
        name: true,
        stockOnHand: true,
        product: { select: { name: true } },
      },
    }),
    prisma.warehouse.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.stockAdjustment.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        type: true,
        quantityChange: true,
        note: true,
        createdAt: true,
        batch: { select: { id: true, batchCode: true } },
        variant: { select: { sku: true, product: { select: { name: true } } } },
        warehouse: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.stockTransfer.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        quantity: true,
        createdAt: true,
        variant: { select: { sku: true, product: { select: { name: true } } } },
        fromWarehouse: { select: { name: true } },
        toWarehouse: { select: { name: true } },
      },
    }),
  ]);
  const variantOptions = variants.map((variant) => ({
    id: variant.id,
    label: `${variant.product.name} · ${variant.name ? `${variant.name} · ` : ""}${variant.sku}`,
    stockOnHand: variant.stockOnHand,
  }));

  return (
    <section aria-labelledby="stock-title">
      <h1 className="admin-page-heading" id="stock-title">ক্যাটালগ ও স্টক টুলস</h1>
      <p className="admin-page-intro">Manual stock changes audit log-এ থাকে। Checkout/POS sales FIFO batch reserve করে, আর purchase receiving নতুন costed batch যোগ করে।</p>

      <section className="admin-panel" aria-labelledby="adjustment-title">
        <h2 id="adjustment-title">স্টক অ্যাডজাস্টমেন্ট</h2>
        {warehouses.length ? (
          <StockAdjustmentForm variants={variantOptions} warehouses={warehouses} />
        ) : <p>আগে একটি সক্রিয় গুদাম যোগ করতে হবে।</p>}
      </section>

      <section className="admin-panel" aria-labelledby="transfer-title">
        <h2 id="transfer-title">গুদামের মধ্যে স্টক স্থানান্তর</h2>
        <p>প্রাচীন FIFO ব্যাচ আগে স্থানান্তর হয় এবং উৎস ও গন্তব্যের ব্যাচ-সম্পর্ক সংরক্ষিত থাকে।</p>
        <StockTransferForm variants={variantOptions} warehouses={warehouses} />
      </section>

      {canManageWarehouses ? (
        <section className="admin-panel" aria-labelledby="warehouse-title">
          <h2 id="warehouse-title">গুদাম</h2>
          {warehouses.length ? (
            <ul className="admin-inline-list">
              {warehouses.map((warehouse) => <li key={warehouse.id}>{warehouse.name} <span>({warehouse.code})</span></li>)}
            </ul>
          ) : <p>এখনো সক্রিয় গুদাম নেই।</p>}
          <h3 className="admin-subsection-heading">গুদাম যোগ করুন</h3>
          <WarehouseForm />
        </section>
      ) : null}

      <section className="admin-panel" aria-labelledby="history-title">
        <h2 id="history-title">সাম্প্রতিক স্টক অ্যাডজাস্টমেন্ট</h2>
        {adjustments.length ? (
          <ul className="admin-plain-list">
            {adjustments.map((adjustment) => (
              <li className="admin-history-item" key={adjustment.id}>
                <strong>{adjustment.variant.product.name} · {adjustment.variant.sku}</strong>
                <span>{adjustment.quantityChange > 0 ? "+" : ""}{adjustment.quantityChange} ইউনিট · {adjustment.type}</span>
                <span>{adjustment.warehouse.name} · {adjustment.createdBy?.name ?? "সিস্টেম"}</span>
                {adjustment.batch ? <span>FIFO batch: {adjustment.batch.batchCode ?? adjustment.batch.id}</span> : null}
                <time dateTime={adjustment.createdAt.toISOString()}>{adjustment.createdAt.toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}</time>
                {adjustment.note ? <p>{adjustment.note}</p> : null}
              </li>
            ))}
          </ul>
        ) : <p>এখনো কোনো স্টক অ্যাডজাস্টমেন্ট নেই।</p>}
      </section>

      <section className="admin-panel" aria-labelledby="transfer-history-title">
        <h2 id="transfer-history-title">সাম্প্রতিক স্থানান্তর</h2>
        {transfers.length ? (
          <ul className="admin-plain-list">
            {transfers.map((transfer) => (
              <li className="admin-history-item" key={transfer.id}>
                <strong>{transfer.variant.product.name} · {transfer.variant.sku}</strong>
                <span>{transfer.quantity} ইউনিট · {transfer.fromWarehouse.name} থেকে {transfer.toWarehouse.name}</span>
                <time dateTime={transfer.createdAt.toISOString()}>{transfer.createdAt.toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}</time>
              </li>
            ))}
          </ul>
        ) : <p>এখনো কোনো স্টক স্থানান্তর নেই।</p>}
      </section>
    </section>
  );
}
