"use server";

import { z } from "zod";
import { requireStaff } from "@/auth/authorization";
import { CheckoutError, createCheckoutOrder } from "@/lib/checkout/order";

const saleSchema = z.object({
  idempotencyKey: z.uuid(),
  source: z.enum(["POS", "FACEBOOK", "PHONE"]),
  customerName: z.string().trim().max(160),
  customerPhone: z.string().trim().max(40).regex(/^[+\d\s()-]*$/)
    .refine((phone) => !phone || phone.replace(/\D/g, "").length >= 8),
  lines: z.array(z.object({
    variantId: z.string().min(1).max(80),
    quantity: z.number().int().min(1).max(100),
  })).min(1).max(50).superRefine((lines, context) => {
    const seen = new Set<string>();
    lines.forEach((line, index) => {
      if (seen.has(line.variantId)) {
        context.addIssue({ code: "custom", message: "Duplicate variant in sale.", path: [index, "variantId"] });
      }
      seen.add(line.variantId);
    });
  }),
});

export async function syncOfflineSale(payload: unknown) {
  const staff = await requireStaff();
  const parsed = saleSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? "Offline sale is invalid." };
  }

  try {
    const order = await createCheckoutOrder({
      customerName: parsed.data.customerName || "Walk-in customer",
      customerPhone: parsed.data.customerPhone || null,
      customerEmail: null,
      address: null,
      area: null,
      city: null,
      deliveryZone: null,
      paymentMethod: "CASH",
      promoCode: null,
      source: parsed.data.source,
      createdById: staff.id,
      idempotencyKey: parsed.data.idempotencyKey,
    }, parsed.data.lines);
    return {
      success: true as const,
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
    };
  } catch (error) {
    if (error instanceof CheckoutError) {
      return { success: false as const, error: error.message };
    }
    throw error;
  }
}
