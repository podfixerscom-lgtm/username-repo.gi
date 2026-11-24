"use server";

import { z } from "zod";
import type { ActionState } from "@/lib/actions/action-state";
import { CheckoutError, createCheckoutOrder, type CheckoutLineInput } from "@/lib/checkout/order";

export type CheckoutActionState = ActionState & {
  orderId?: string;
  orderTotal?: string;
};

const checkoutSchema = z.object({
  customerName: z.string().trim().min(2).max(160),
  customerPhone: z.string().trim().min(8).max(40).regex(/^[+\d\s()-]+$/),
  customerEmail: z.union([z.literal(""), z.email()]),
  address: z.string().trim().min(5).max(3000),
  area: z.string().trim().max(120),
  city: z.string().trim().min(2).max(120),
  deliveryZone: z.enum(["DHAKA", "CHATTOGRAM", "REST_OF_BANGLADESH"]),
  paymentMethod: z.enum(["COD", "BKASH", "NAGAD", "SSLCOMMERZ"]),
  promoCode: z.string().trim().toUpperCase().max(60),
  cart: z.string().min(2).max(20_000),
});

const cartSchema = z.array(z.object({
  variantId: z.string().min(1).max(80),
  quantity: z.number().int().min(1).max(100),
})).min(1).max(50).superRefine((items, context) => {
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (seen.has(item.variantId)) {
      context.addIssue({
        code: "custom",
        message: "Cart contains a duplicate item.",
        path: [index, "variantId"],
      });
    }
    seen.add(item.variantId);
  }
});

function value(formData: FormData, name: string): string {
  const formValue = formData.get(name);
  return typeof formValue === "string" ? formValue : "";
}

export async function placeOrder(
  _previousState: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const parsed = checkoutSchema.safeParse({
    customerName: value(formData, "customerName"),
    customerPhone: value(formData, "customerPhone"),
    customerEmail: value(formData, "customerEmail").trim(),
    address: value(formData, "address"),
    area: value(formData, "area"),
    city: value(formData, "city"),
    deliveryZone: value(formData, "deliveryZone"),
    paymentMethod: value(formData, "paymentMethod"),
    promoCode: value(formData, "promoCode"),
    cart: value(formData, "cart"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Checkout details are invalid." };
  }

  let cart: CheckoutLineInput[];
  try {
    const raw: unknown = JSON.parse(parsed.data.cart);
    const cartResult = cartSchema.safeParse(raw);
    if (!cartResult.success) {
      return { error: "Your cart is invalid. Review the items and try again." };
    }
    cart = cartResult.data;
  } catch {
    return { error: "Your cart is invalid. Review the items and try again." };
  }

  try {
    const order = await createCheckoutOrder({
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
      customerEmail: parsed.data.customerEmail || null,
      address: parsed.data.address,
      area: parsed.data.area || null,
      city: parsed.data.city,
      deliveryZone: parsed.data.deliveryZone,
      paymentMethod: parsed.data.paymentMethod,
      promoCode: parsed.data.promoCode || null,
    }, cart);
    return {
      success: "অর্ডার গ্রহণ করা হয়েছে।",
      orderId: order.id,
      orderTotal: order.total,
    };
  } catch (error) {
    if (error instanceof CheckoutError) return { error: error.message };
    throw error;
  }
}
