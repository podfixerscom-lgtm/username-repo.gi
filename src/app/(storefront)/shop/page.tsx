import Link from "next/link";
import type { Metadata } from "next";
import { getPrisma } from "@/lib/prisma";
import { ProductCard } from "../components/product-card";
import { SearchEvent } from "../components/search-event";

export const metadata: Metadata = { title: "শপ" };

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 100) ?? "";
  const categorySlug = params.category?.trim().slice(0, 160) ?? "";
  const prisma = getPrisma();
  const [products, categories, activeCategory] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true,
        variants: { some: { isActive: true } },
        ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }] } : {}),
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        variants: { where: { isActive: true }, select: { price: true, stockOnHand: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, altText: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
    categorySlug ? prisma.category.findUnique({ where: { slug: categorySlug }, select: { name: true } }) : null,
  ]);

  return (
    <section aria-labelledby="shop-title">
      <SearchEvent query={query} />
      <div className="store-section-heading">
        <div>
          <h1 id="shop-title">{activeCategory?.name ?? "সব পণ্য"}</h1>
          <p>{products.length}টি পণ্য পাওয়া গেছে</p>
        </div>
      </div>
      <form className="store-search" action="/shop" role="search">
        <label htmlFor="shop-search">পণ্য খুঁজুন</label>
        <input id="shop-search" name="q" type="search" defaultValue={query} maxLength={100} />
        {categorySlug ? <input type="hidden" name="category" value={categorySlug} /> : null}
        <button className="store-button" type="submit">খুঁজুন</button>
      </form>
      <nav className="store-category-nav" aria-label="পণ্য ক্যাটাগরি">
        <Link href="/shop" aria-current={!categorySlug ? "page" : undefined}>সব</Link>
        {categories.map((category) => (
          <Link
            href={`/shop?category=${encodeURIComponent(category.slug)}`}
            aria-current={categorySlug === category.slug ? "page" : undefined}
            key={category.id}
          >{category.name}</Link>
        ))}
      </nav>
      {products.length ? (
        <div className="store-product-grid">
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      ) : <p className="store-empty">এই অনুসন্ধানে কোনো পণ্য পাওয়া যায়নি।</p>}
    </section>
  );
}
