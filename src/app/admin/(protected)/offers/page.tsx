import type { Metadata } from "next";
import { requireStaff } from "@/auth/authorization";
import { getPrisma } from "@/lib/prisma";
import { OfferForm } from "./offer-forms";

export const metadata: Metadata = { title: "অফার পরিচালনা | Crazy Cart Operations" };

export default async function OffersAdminPage() {
  await requireStaff(["ADMIN", "MANAGER"]);
  const offers = await getPrisma().offer.findMany({ orderBy: { updatedAt: "desc" } });
  return (
    <section aria-labelledby="admin-offers-title">
      <h1 className="admin-page-heading" id="admin-offers-title">অফার পরিচালনা</h1>
      <p className="admin-page-intro">Promo code, সময়সীমা এবং storefront popup নিয়ন্ত্রণ করুন।</p>
      <section className="admin-panel" aria-labelledby="new-offer-title">
        <h2 id="new-offer-title">নতুন Offer</h2>
        <OfferForm />
      </section>
      <section className="admin-panel" aria-labelledby="existing-offers-title">
        <h2 id="existing-offers-title">বর্তমান Offer</h2>
        {offers.length ? (
          <div className="admin-stack">
            {offers.map((offer) => (
              <article className="admin-subpanel" key={offer.id}>
                <h3>{offer.title}</h3>
                <p>{offer.isActive ? "সক্রিয়" : "নিষ্ক্রিয়"}{offer.promoCode ? ` · কোড ${offer.promoCode}` : ""}</p>
                <OfferForm offer={{
                  id: offer.id,
                  title: offer.title,
                  description: offer.description,
                  promoCode: offer.promoCode,
                  discountType: offer.discountType,
                  discountValue: offer.discountValue?.toString() ?? null,
                  startsAt: offer.startsAt ? offer.startsAt.toISOString().slice(0, 16) : "",
                  endsAt: offer.endsAt ? offer.endsAt.toISOString().slice(0, 16) : "",
                  isActive: offer.isActive,
                  showPopup: offer.showPopup,
                }} />
              </article>
            ))}
          </div>
        ) : <p>কোনো offer তৈরি হয়নি।</p>}
      </section>
    </section>
  );
}
