import type { Metadata } from "next";
import { connection } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "অফার" };

export default async function OffersPage() {
  await connection();
  const now = new Date();
  const offers = await getPrisma().offer.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <section aria-labelledby="offers-title">
      <h1 id="offers-title">চলমান অফার</h1>
      {offers.length ? (
        <div className="store-offer-grid">
          {offers.map((offer) => (
            <article className="store-offer-card" key={offer.id}>
              <h2>{offer.title}</h2>
              <p>{offer.description}</p>
              {offer.promoCode ? <p>Checkout-এ ব্যবহার করুন: <strong>{offer.promoCode}</strong></p> : null}
              {offer.discountType && offer.discountValue ? (
                <p className="offer-discount">
                  {offer.discountType === "PERCENTAGE"
                    ? `${offer.discountValue.toString()}% ছাড়`
                    : `৳${offer.discountValue.toFixed(2)} ছাড়`}
                </p>
              ) : null}
              {offer.endsAt ? <p>শেষ হবে: <time dateTime={offer.endsAt.toISOString()}>{offer.endsAt.toLocaleDateString("bn-BD")}</time></p> : null}
            </article>
          ))}
        </div>
      ) : <p className="store-empty">এই মুহূর্তে কোনো সক্রিয় অফার নেই।</p>}
    </section>
  );
}
