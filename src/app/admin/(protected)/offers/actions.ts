"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/auth/authorization";
import type { ActionState } from "@/lib/actions/action-state";
import { getPrisma } from "@/lib/prisma";

function readFormString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

const offerSchema = z.object({
  id: z.string().trim(),
  title: z.string().trim().min(2).max(180),
  description: z.string().trim().max(5000),
  promoCode: z.string().trim().toUpperCase().max(60).regex(/^$|^[A-Z0-9_-]+$/),
  discountType: z.enum(["NONE", "FIXED", "PERCENTAGE"]),
  discountValue: z.string().trim(),
  startsAt: z.string().trim(),
  endsAt: z.string().trim(),
  isActive: z.boolean(),
  showPopup: z.boolean(),
}).superRefine((data, context) => {
  if (data.discountType !== "NONE") {
    const discount = Number(data.discountValue);
    if (!data.discountValue || !Number.isFinite(discount) || discount < 0 ||
      (data.discountType === "PERCENTAGE" && discount > 100)) {
      context.addIssue({ code: "custom", message: "Discount value is invalid.", path: ["discountValue"] });
    }
  }
  for (const field of ["startsAt", "endsAt"] as const) {
    if (data[field] && Number.isNaN(Date.parse(data[field]))) {
      context.addIssue({ code: "custom", message: "Offer date is invalid.", path: [field] });
    }
  }
  if (data.startsAt && data.endsAt && Date.parse(data.startsAt) > Date.parse(data.endsAt)) {
    context.addIssue({ code: "custom", message: "Offer end must be after its start.", path: ["endsAt"] });
  }
});

export async function saveOffer(_previous: ActionState, formData: FormData): Promise<ActionState> {
  await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = offerSchema.safeParse({
    id: readFormString(formData, "id"),
    title: readFormString(formData, "title"),
    description: readFormString(formData, "description"),
    promoCode: readFormString(formData, "promoCode"),
    discountType: readFormString(formData, "discountType"),
    discountValue: readFormString(formData, "discountValue"),
    startsAt: readFormString(formData, "startsAt"),
    endsAt: readFormString(formData, "endsAt"),
    isActive: formData.get("isActive") === "on",
    showPopup: formData.get("showPopup") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Offer details are invalid." };

  const input = parsed.data;
  if (input.promoCode) {
    const duplicate = await getPrisma().offer.findFirst({
      where: { promoCode: input.promoCode, ...(input.id ? { id: { not: input.id } } : {}) },
      select: { id: true },
    });
    if (duplicate) return { error: "That promo code is already in use." };
  }
  if (input.id && !(await getPrisma().offer.findUnique({ where: { id: input.id }, select: { id: true } }))) {
    return { error: "Offer was not found." };
  }

  const discountType = input.discountType === "NONE" ? null : input.discountType;
  const discountValue = discountType ? Number(input.discountValue).toFixed(2) : null;
  const data = {
    title: input.title,
    description: input.description,
    promoCode: input.promoCode || null,
    discountType,
    discountValue,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    isActive: input.isActive,
    showPopup: input.showPopup && input.isActive,
  };
  if (input.id) {
    await getPrisma().offer.update({ where: { id: input.id }, data });
  } else {
    await getPrisma().offer.create({ data });
  }

  revalidatePath("/");
  revalidatePath("/offers");
  revalidatePath("/admin/offers");
  return { success: "Offer saved." };
}

export async function moderateReview(formData: FormData): Promise<void> {
  await requireStaff(["ADMIN", "MANAGER"]);
  const reviewId = readFormString(formData, "reviewId");
  const approved = formData.get("approved") === "true";
  if (!reviewId) throw new Error("Review identifier is required.");
  const review = await getPrisma().productReview.findUnique({
    where: { id: reviewId },
    select: { product: { select: { slug: true } } },
  });
  if (!review) throw new Error("Review was not found.");
  await getPrisma().productReview.update({
    where: { id: reviewId },
    data: { isApproved: approved },
  });
  revalidatePath(`/shop/${review.product.slug}`);
  revalidatePath("/admin/reviews");
}
