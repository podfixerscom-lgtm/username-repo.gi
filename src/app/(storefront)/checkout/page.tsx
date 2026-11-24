import type { Metadata } from "next";
import { connection } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  await connection();
  const prisma = getPrisma();
  const [rates, shippingClasses, settings] = await Promise.all([
    prisma.deliveryRate.findMany({ where: { isActive: true } }),
    prisma.shippingClass.findMany({
      where: { isActive: true },
      select: { id: true, code: true, surcharge: true },
    }),
    prisma.generalSettings.findUnique({
      where: { id: "store" },
      select: { freeDeliveryAboveBDT: true },
    }),
  ]);
  return (
    <section aria-labelledby="checkout-title">
      <h1 id="checkout-title">Checkout</h1>
      <p className="store-page-intro">অর্ডারের মূল্য ও স্টক সার্ভারে আবার যাচাই করা হবে।</p>
      <CheckoutForm
        rates={rates.map((rate) => ({
          zone: rate.zone,
          baseCharge: rate.baseCharge.toString(),
          includedWeightGrams: rate.includedWeightGrams,
          extraPerKgCharge: rate.extraPerKgCharge.toString(),
        }))}
        shippingClasses={shippingClasses.map((shippingClass) => ({
          id: shippingClass.id,
          code: shippingClass.code,
          surcharge: shippingClass.surcharge.toString(),
        }))}
        freeDeliveryAboveBDT={settings?.freeDeliveryAboveBDT?.toNumber() ?? null}
      />
    </section>
  );
}
