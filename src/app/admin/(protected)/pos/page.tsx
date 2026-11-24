import type { Metadata } from "next";
import { requireStaff } from "@/auth/authorization";
import { getPrisma } from "@/lib/prisma";
import { PosTerminal } from "./pos-terminal";

export const metadata: Metadata = { title: "POS | Crazy Cart Operations" };

export default async function PosPage() {
  await requireStaff();
  const variants = await getPrisma().productVariant.findMany({
    where: {
      isActive: true,
      product: { isActive: true, type: "PHYSICAL" },
    },
    orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
    select: {
      id: true,
      sku: true,
      name: true,
      price: true,
      stockOnHand: true,
      product: { select: { name: true } },
    },
  });
  return (
    <section aria-labelledby="pos-title">
      <h1 className="admin-page-heading" id="pos-title">Counter POS</h1>
      <p className="admin-page-intro">Sales are saved to this browser’s offline queue first. When reconnected, server prices and stock are checked before an order is committed. Keep this page open while disconnected.</p>
      <PosTerminal variants={variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        label: `${variant.product.name} · ${variant.name ? `${variant.name} · ` : ""}${variant.sku}`,
        price: variant.price.toString(),
        stockOnHand: variant.stockOnHand,
      }))} />
    </section>
  );
}
