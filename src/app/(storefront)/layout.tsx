import Link from "next/link";
import { connection } from "next/server";
import type { CSSProperties, ReactNode } from "react";
import { getPrisma } from "@/lib/prisma";
import { CartProvider } from "./cart-provider";
import { CartCount } from "./components/cart-count";
import { MarketingProvider } from "./components/marketing-provider";
import { StorefrontOfferPopup } from "./components/offer-popup";
import { ConsentBanner } from "./components/consent-banner";
import "./storefront.css";

type StorefrontTheme = CSSProperties & {
  "--store-brand": string;
  "--store-accent": string;
};

export const instant = false;

export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  await connection();
  const prisma = getPrisma();
  const [settings, popupOffer] = await Promise.all([
    prisma.generalSettings.findUnique({ where: { id: "store" } }),
    prisma.offer.findFirst({
      where: {
        isActive: true,
        showPopup: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, description: true },
    }),
  ]);
  const store = settings ?? {
    storeName: "Crazy Cart",
    tagline: "Everything you need, at crazy speed.",
    contactPhone: "01611179008",
    contactAddress: "Halishahar, Chittagong",
    footerMessage: "আপনার প্রতিদিনের কেনাকাটার নির্ভরযোগ্য ঠিকানা।",
    themePrimaryColor: "#176b48",
    themeAccentColor: "#a6edbb",
    announcementText: "Everything you need, at crazy speed.",
  };
  const theme: StorefrontTheme = {
    "--store-brand": store.themePrimaryColor,
    "--store-accent": store.themeAccentColor,
  };

  return (
    <CartProvider>
      <div className="storefront" style={theme}>
        {store.announcementText ? <p className="store-announcement">{store.announcementText}</p> : null}
        <header className="store-header">
          <Link className="store-brand" href="/" aria-label={`${store.storeName} - হোম`}>
            {store.storeName}
          </Link>
          <nav aria-label="প্রধান নেভিগেশন">
            <Link href="/shop">শপ</Link>
            <Link href="/offers">অফার</Link>
            <Link href="/cart" className="store-cart-link">কার্ট <CartCount /></Link>
          </nav>
        </header>
        <main className="store-main" id="main-content" tabIndex={-1}>{children}</main>
        <footer className="store-footer">
          <div>
            <Link className="store-brand" href="/">{store.storeName}</Link>
            <p>{store.footerMessage}</p>
          </div>
          <address>
            {store.contactPhone ? <a href={`tel:${store.contactPhone}`}>{store.contactPhone}</a> : null}
            {store.contactAddress ? <span>{store.contactAddress}</span> : null}
          </address>
        </footer>
        {popupOffer ? <StorefrontOfferPopup offer={popupOffer} /> : null}
        <ConsentBanner />
        <MarketingProvider />
      </div>
    </CartProvider>
  );
}
