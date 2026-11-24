import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { ProductCard } from "./components/product-card";

export const metadata: Metadata = { title: "হোম" };

export default async function StorefrontHome() {
  await connection();
  const prisma = getPrisma();
  const [settings, products, offers] = await Promise.all([
    prisma.generalSettings.findUnique({ where: { id: "store" } }),
    prisma.product.findMany({
      where: { isActive: true, variants: { some: { isActive: true } } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        variants: { where: { isActive: true }, select: { price: true, stockOnHand: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, altText: true } },
      },
    }),
    prisma.offer.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, title: true, description: true, promoCode: true },
    }),
  ]);
  const storeName = settings?.storeName ?? "Crazy Cart";
  const heroTitle = settings?.homeHeroTitle ?? storeName;
  const heroDescription = settings?.homeHeroDescription ?? "Everything you need, at crazy speed.";

  return (
    <>
      <section className="store-hero" aria-labelledby="home-title">
        <p className="store-eyebrow">আপনার নতুন পছন্দের অনলাইন স্টোর</p>
        <h1 id="home-title">{heroTitle}</h1>
        <p>{heroDescription}</p>
        <Link className="store-button" href="/shop">এখনই শপ করুন</Link>
      </section>
      {offers.length ? (
        <section className="store-section" aria-labelledby="home-offers-title">
          <div className="store-section-heading">
            <h2 id="home-offers-title">চলমান অফার</h2>
            <Link href="/offers">সব অফার</Link>
          </div>
          <div className="store-offer-grid">
            {offers.map((offer) => (
              <article className="store-offer-card" key={offer.id}>
                <h3>{offer.title}</h3>
                <p>{offer.description}</p>
                {offer.promoCode ? <p>কোড: <strong>{offer.promoCode}</strong></p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
      <section className="store-section" aria-labelledby="featured-products-title">
        <div className="store-section-heading">
          <h2 id="featured-products-title">নতুন পণ্য</h2>
          <Link href="/shop">সব পণ্য দেখুন</Link>
        </div>
        {products.length ? (
          <div className="store-product-grid">
            {products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        ) : <p className="store-empty">পণ্য যোগ হলে এখানে দেখা যাবে।</p>}
      </section>
    </>
  );
}
