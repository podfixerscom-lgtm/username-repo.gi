import type { Metadata } from "next";
import { requireStaff } from "@/auth/authorization";
import { getPrisma } from "@/lib/prisma";
import { DeliveryRateForm, ShippingClassForm, StorefrontSettingsForm } from "./settings-forms";

export const metadata: Metadata = {
  title: "স্টোরফ্রন্ট ও ডেলিভারি সেটিংস",
};

const zoneLabels = {
  DHAKA: "ঢাকা",
  CHATTOGRAM: "চট্টগ্রাম",
  REST_OF_BANGLADESH: "বাংলাদেশের অন্যান্য এলাকা",
} as const;

export default async function GeneralSettingsPage() {
  await requireStaff(["ADMIN", "MANAGER"]);
  const prisma = getPrisma();
  const [settings, rates, shippingClasses] = await Promise.all([
    prisma.generalSettings.findUnique({ where: { id: "store" } }),
    prisma.deliveryRate.findMany({ orderBy: { zone: "asc" } }),
    prisma.shippingClass.findMany({ orderBy: { code: "asc" } }),
  ]);

  return (
    <section aria-labelledby="settings-title">
      <h1 className="admin-page-heading" id="settings-title">স্টোরফ্রন্ট ও ডেলিভারি সেটিংস</h1>
      <p className="admin-page-intro">Store theme, হোমপেজের লেখা, যোগাযোগ, free-delivery threshold, checkout prefix এবং Inventory pending rule পরিচালনা করুন।</p>

      <section className="admin-panel" aria-labelledby="store-settings-title">
        <h2 id="store-settings-title">স্টোরফ্রন্ট কাস্টমাইজেশন</h2>
        {settings ? (
          <StorefrontSettingsForm
            settings={{
              ...settings,
              freeDeliveryAboveBDT: settings.freeDeliveryAboveBDT?.toString() ?? null,
            }}
          />
        ) : (
          <p className="settings-empty">সেটিংস তৈরি হয়নি। <code>npm run db:seed</code> চালান।</p>
        )}
      </section>

      <section className="admin-panel" aria-labelledby="delivery-rates-title">
        <h2 id="delivery-rates-title">এলাকাভিত্তিক ডেলিভারি চার্জ</h2>
        <p>অন্তর্ভুক্ত ওজনের বেশি হলে প্রতি শুরু হওয়া অতিরিক্ত কেজিতে নির্ধারিত চার্জ যোগ হবে।</p>
        {rates.length ? (
          <div className="admin-stack">
            {rates.map((rate) => (
              <DeliveryRateForm
                key={rate.id}
                label={zoneLabels[rate.zone]}
                rate={{
                  zone: rate.zone,
                  baseCharge: rate.baseCharge.toString(),
                  includedWeightGrams: rate.includedWeightGrams,
                  extraPerKgCharge: rate.extraPerKgCharge.toString(),
                }}
              />
            ))}
          </div>
        ) : <p className="settings-empty">ডেলিভারি rate নেই। <code>npm run db:seed</code> চালান।</p>}
      </section>

      <section className="admin-panel" aria-labelledby="shipping-classes-title">
        <h2 id="shipping-classes-title">Shipping Classes</h2>
        <p>প্রতি আলাদা class package-এ surcharge একবার যোগ হয়। পণ্যের সম্পাদনা পৃষ্ঠা থেকে class নির্বাচন করুন।</p>
        <div className="admin-stack">
          {shippingClasses.map((shippingClass) => (
            <ShippingClassForm
              key={shippingClass.id}
              shippingClass={{
                code: shippingClass.code,
                name: shippingClass.name,
                surcharge: shippingClass.surcharge.toString(),
                isActive: shippingClass.isActive,
              }}
            />
          ))}
          <ShippingClassForm />
        </div>
      </section>
    </section>
  );
}
