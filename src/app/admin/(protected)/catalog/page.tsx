import type { Metadata } from "next";
import { requireStaff } from "@/auth/authorization";
import { getPrisma } from "@/lib/prisma";
import {
  CreateBrandForm,
  CreateCategoryForm,
  EditBrandForm,
  EditCategoryForm,
} from "./catalog-forms";

export const metadata: Metadata = { title: "ক্যাটালগ ও স্টক টুলস | Crazy Cart Operations" };

export default async function CatalogPage() {
  await requireStaff(["ADMIN", "MANAGER"]);
  const prisma = getPrisma();
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ parent: { name: "asc" } }, { name: "asc" }],
      include: { parent: { select: { name: true } }, _count: { select: { products: true } } },
    }),
    prisma.brand.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    }),
  ]);
  const categoryOptions = categories.map(({ id, name }) => ({ id, name }));

  return (
    <section aria-labelledby="catalog-title">
      <h1 className="admin-page-heading" id="catalog-title">ক্যাটালগ ও স্টক টুলস</h1>
      <p className="admin-page-intro">ক্যাটাগরি, ব্র্যান্ড ও তাদের পণ্য-সম্পর্ক পরিচালনা করুন।</p>

      <section className="admin-panel" aria-labelledby="categories-title">
        <h2 id="categories-title">ক্যাটাগরি</h2>
        {categories.length ? (
          <ul className="admin-card-grid">
            {categories.map((category) => (
              <li className="admin-subpanel" key={category.id}>
                <h3>{category.name}</h3>
                <p>{category.parent ? `প্যারেন্ট: ${category.parent.name} · ` : ""}{category._count.products}টি পণ্য</p>
                <EditCategoryForm category={category} />
              </li>
            ))}
          </ul>
        ) : <p>কোনো ক্যাটাগরি নেই। প্রথম ক্যাটাগরিটি যোগ করুন।</p>}
        <h3 className="admin-subsection-heading">ক্যাটাগরি যোগ</h3>
        <CreateCategoryForm parents={categoryOptions} />
      </section>

      <section className="admin-panel" aria-labelledby="brands-title">
        <h2 id="brands-title">ব্র্যান্ড</h2>
        {brands.length ? (
          <ul className="admin-card-grid">
            {brands.map((brand) => (
              <li className="admin-subpanel" key={brand.id}>
                <h3>{brand.name}</h3>
                <p>{brand._count.products}টি পণ্যে ব্যবহৃত</p>
                <EditBrandForm brand={brand} />
              </li>
            ))}
          </ul>
        ) : <p>কোনো ব্র্যান্ড নেই। প্রথম ব্র্যান্ডটি যোগ করুন।</p>}
        <h3 className="admin-subsection-heading">ব্র্যান্ড যোগ</h3>
        <CreateBrandForm />
      </section>
    </section>
  );
}
