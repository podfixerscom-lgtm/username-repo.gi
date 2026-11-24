import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/auth/authorization";
import { ProductCreateForm } from "../product-create-form";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "নতুন পণ্য | Crazy Cart Operations" };

export default async function NewProductPage() {
  await requireStaff(["ADMIN", "MANAGER"]);
  const prisma = getPrisma();
  const [categories, brands, shippingClasses] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.shippingClass.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <section aria-labelledby="new-product-title">
      <Link className="admin-back-link" href="/admin/inventory/products">← পণ্যের তালিকায় ফিরুন</Link>
      <h1 className="admin-page-heading" id="new-product-title">নতুন পণ্য</h1>
      <p className="admin-page-intro">পণ্য তৈরি হলে একটি প্রাথমিক ভ্যারিয়েন্ট যোগ হবে। SKU আলাদা হতে হবে।</p>
      <div className="admin-panel">
        <ProductCreateForm
          categories={categories}
          brands={brands}
          shippingClasses={shippingClasses}
        />
      </div>
    </section>
  );
}
