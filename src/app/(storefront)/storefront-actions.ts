"use server";

import { z } from "zod";
import type { ActionState } from "@/lib/actions/action-state";
import { getPrisma } from "@/lib/prisma";

const cartIdsSchema = z.array(z.string().min(1).max(80)).max(50);

export async function getCartPreview(variantIds: string[]) {
  const parsed = cartIdsSchema.safeParse(variantIds);
  if (!parsed.success || parsed.data.length === 0) return [];

  const variants = await getPrisma().productVariant.findMany({
    where: {
      id: { in: parsed.data },
      isActive: true,
      product: { isActive: true },
    },
    select: {
      id: true,
      name: true,
      sku: true,
      size: true,
      color: true,
      price: true,
      stockOnHand: true,
      product: {
        select: {
          name: true,
          slug: true,
          type: true,
          allowPreorder: true,
          weightGrams: true,
          shippingClass: { select: { id: true, surcharge: true, isActive: true } },
          images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, altText: true } },
        },
      },
    },
  });
  return variants.map((variant) => ({
    id: variant.id,
    variantName: variant.name,
    sku: variant.sku,
    size: variant.size,
    color: variant.color,
    price: variant.price.toString(),
    stockOnHand: variant.stockOnHand,
    allowPreorder: variant.product.allowPreorder,
    weightGrams: variant.product.weightGrams,
    shippingClassId: variant.product.shippingClass?.isActive ? variant.product.shippingClass.id : null,
    shippingSurcharge: variant.product.shippingClass?.isActive
      ? variant.product.shippingClass.surcharge.toString()
      : null,
    productName: variant.product.name,
    slug: variant.product.slug,
    productType: variant.product.type,
    image: variant.product.images[0] ?? null,
  }));
}

const reviewSchema = z.object({
  productId: z.string().min(1).max(80),
  customerName: z.string().trim().min(2).max(120),
  rating: z.string().regex(/^[1-5]$/).transform(Number),
  title: z.string().trim().max(180),
  body: z.string().trim().min(10).max(5000),
});

export async function submitProductReview(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = reviewSchema.safeParse({
    productId: formData.get("productId"),
    customerName: formData.get("customerName"),
    rating: formData.get("rating"),
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Review details are invalid." };
  }
  const product = await getPrisma().product.findFirst({
    where: { id: parsed.data.productId, isActive: true },
    select: { id: true },
  });
  if (!product) return { error: "Product is no longer available." };

  await getPrisma().productReview.create({
    data: {
      productId: product.id,
      customerName: parsed.data.customerName,
      rating: parsed.data.rating,
      title: parsed.data.title || null,
      body: parsed.data.body,
    },
  });
  return { success: "আপনার রিভিউ moderation-এর জন্য জমা হয়েছে।" };
}
