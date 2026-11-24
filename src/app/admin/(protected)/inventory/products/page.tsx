import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/auth/authorization";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "পণ্য | Crazy Cart Operations" };

export default async function ProductsPage() {
  const user = await requireStaff();
  const canEdit = user.role !== "STAFF";
  const products = await getPrisma().product.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      category: { select: { name: true } },
      brand: { select: { name: true } },
      variants: { select: { stockOnHand: true, isActive: true } },
    },
  });

  return (
    <section aria-labelledby="products-title">
      <div className="admin-page-title-row">
        <div>
          <h1 className="admin-page-heading" id="products-title">পণ্য</h1>
          <p className="admin-page-intro">ক্যাটালগ, মূল্য, ভ্যারিয়েন্ট, ছবি এবং মোট স্টক পরিচালনা করুন।</p>
        </div>
        {canEdit ? <Link className="admin-button" href="/admin/inventory/products/new">নতুন পণ্য</Link> : null}
      </div>
      {products.length === 0 ? (
        <div className="admin-panel"><p>এখনো কোনো পণ্য নেই। নতুন পণ্য তৈরি করে শুরু করুন।</p></div>
      ) : (
        <ul className="admin-card-grid admin-product-list">
          {products.map((product) => {
            const activeVariants = product.variants.filter((variant) => variant.isActive);
            const stock = product.variants.reduce((total, variant) => total + variant.stockOnHand, 0);
            return (
              <li className="admin-panel admin-list-card" key={product.id}>
                <h2><Link href={`/admin/inventory/products/${product.id}`}>{product.name}</Link></h2>
                <dl className="admin-inline-details">
                  <div><dt>ধরন</dt><dd>{product.type === "DIGITAL" ? "ডিজিটাল" : "ফিজিক্যাল"}</dd></div>
                  <div><dt>মূল্য</dt><dd>৳{product.price.toFixed(2)}</dd></div>
                  <div><dt>ভ্যারিয়েন্ট</dt><dd>{activeVariants.length} সক্রিয়</dd></div>
                  <div><dt>মোট স্টক</dt><dd>{stock} ইউনিট</dd></div>
                  <div><dt>ক্যাটাগরি</dt><dd>{product.category?.name ?? "—"}</dd></div>
                  <div><dt>ব্র্যান্ড</dt><dd>{product.brand?.name ?? "—"}</dd></div>
                </dl>
                {product.isResellerProduct ? <p className="admin-status-note">রিসেলার সোর্স: {product.externalSourceId ? "সংযুক্ত" : "সোর্স সরানো হয়েছে"}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
