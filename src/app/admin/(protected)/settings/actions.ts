"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/auth/authorization";
import type { ActionState } from "@/lib/actions/action-state";
import { getPrisma } from "@/lib/prisma";

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function relativeLuminance(color: string) {
  const channels = [1, 3, 5].map((start) => {
    const channel = Number.parseInt(color.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function hasTextContrast(foreground: string, background: string) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05) >= 4.5;
}

const primaryColorSchema = z.string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .refine((value) => hasTextContrast(value, "#ffffff"), "Primary color must meet 4.5:1 contrast on white.");
const accentColorSchema = z.string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .refine((value) => hasTextContrast(value, "#13291e"), "Accent color must meet 4.5:1 contrast on the hero background.");
const moneyField = z.string()
  .trim()
  .regex(/^\d{1,8}(?:\.\d{1,2})?$/)
  .transform(Number)
  .refine(Number.isFinite);
const optionalMoneyField = z.union([z.literal(""), moneyField])
  .transform((value) => value === "" ? null : value);

const settingsSchema = z.object({
  storeName: z.string().trim().min(2).max(160),
  tagline: z.string().trim().min(2).max(240),
  orderNumberPrefix: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9-]+$/),
  contactEmail: z.union([z.literal(""), z.email()]),
  contactPhone: z.string().trim().max(40),
  contactAddress: z.string().trim().max(2000),
  themePrimaryColor: primaryColorSchema,
  themeAccentColor: accentColorSchema,
  announcementText: z.string().trim().max(240),
  homeHeroTitle: z.string().trim().min(2).max(180),
  homeHeroDescription: z.string().trim().max(5000),
  footerMessage: z.string().trim().max(5000),
  autoMoveToPending: z.boolean(),
  freeDeliveryAboveBDT: optionalMoneyField,
});

export async function saveStorefrontSettings(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = settingsSchema.safeParse({
    storeName: readFormString(formData, "storeName"),
    tagline: readFormString(formData, "tagline"),
    orderNumberPrefix: readFormString(formData, "orderNumberPrefix"),
    contactEmail: readFormString(formData, "contactEmail").trim(),
    contactPhone: readFormString(formData, "contactPhone"),
    contactAddress: readFormString(formData, "contactAddress"),
    themePrimaryColor: readFormString(formData, "themePrimaryColor"),
    themeAccentColor: readFormString(formData, "themeAccentColor"),
    announcementText: readFormString(formData, "announcementText"),
    homeHeroTitle: readFormString(formData, "homeHeroTitle"),
    homeHeroDescription: readFormString(formData, "homeHeroDescription"),
    footerMessage: readFormString(formData, "footerMessage"),
    autoMoveToPending: formData.get("autoMoveToPending") === "on",
    freeDeliveryAboveBDT: readFormString(formData, "freeDeliveryAboveBDT"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Store settings are invalid." };
  }

  await getPrisma().generalSettings.update({
    where: { id: "store" },
    data: {
      ...parsed.data,
      contactEmail: parsed.data.contactEmail || null,
      contactPhone: parsed.data.contactPhone || null,
      contactAddress: parsed.data.contactAddress || null,
      freeDeliveryAboveBDT: parsed.data.freeDeliveryAboveBDT?.toFixed(2) ?? null,
    },
  });

  revalidatePath("/");
  revalidatePath("/shop");
  revalidatePath("/checkout");
  revalidatePath("/admin/settings");
  return { success: "Storefront settings saved." };
}

const deliveryRateSchema = z.object({
  zone: z.enum(["DHAKA", "CHATTOGRAM", "REST_OF_BANGLADESH"]),
  baseCharge: moneyField,
  includedWeightGrams: z.string().trim().regex(/^[1-9]\d{0,5}$/).transform(Number),
  extraPerKgCharge: moneyField,
});

export async function saveDeliveryRate(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = deliveryRateSchema.safeParse({
    zone: readFormString(formData, "zone"),
    baseCharge: readFormString(formData, "baseCharge"),
    includedWeightGrams: readFormString(formData, "includedWeightGrams"),
    extraPerKgCharge: readFormString(formData, "extraPerKgCharge"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Delivery rate is invalid." };
  }

  const input = parsed.data;
  await getPrisma().deliveryRate.update({
    where: { zone: input.zone },
    data: {
      baseCharge: input.baseCharge.toFixed(2),
      includedWeightGrams: input.includedWeightGrams,
      extraPerKgCharge: input.extraPerKgCharge.toFixed(2),
    },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/checkout");
  return { success: "Delivery rate saved." };
}

const shippingClassSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,40}$/),
  name: z.string().trim().min(2).max(80),
  surcharge: moneyField,
  isActive: z.boolean(),
});

export async function saveShippingClass(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = shippingClassSchema.safeParse({
    code: readFormString(formData, "code"),
    name: readFormString(formData, "name"),
    surcharge: readFormString(formData, "surcharge"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Shipping class is invalid." };
  }

  const { code, ...data } = parsed.data;
  await getPrisma().shippingClass.upsert({
    where: { code },
    create: { code, ...data, surcharge: data.surcharge.toFixed(2) },
    update: { ...data, surcharge: data.surcharge.toFixed(2) },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/shop");
  return { success: "Shipping class saved." };
}
