import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type {
  DeliveryZone,
  OrderSource,
  PaymentMethod,
  Prisma as PrismaTypes,
} from "@/generated/prisma/client";
import { normalizeCustomerPhone } from "@/lib/customers/phone";
import { getPrisma } from "@/lib/prisma";
import { formatOrderNumber } from "./order-number";
import { calculateOfferDiscount, calculateShippingCharge } from "./shipping";

export type CheckoutTransaction = PrismaTypes.TransactionClient;

export type CheckoutLineInput = {
  variantId: string;
  quantity: number;
};

export type CheckoutDetails = {
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  address: string | null;
  area: string | null;
  city: string | null;
  deliveryZone: DeliveryZone | null;
  paymentMethod: PaymentMethod;
  promoCode: string | null;
  source?: OrderSource;
  createdById?: string | null;
  idempotencyKey?: string;
};

export class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutError";
  }
}

function amountToCents(value: Prisma.Decimal | string | number): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new CheckoutError("A product has an invalid price.");
  }
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents)) {
    throw new CheckoutError("A product price exceeds the supported range.");
  }
  return cents;
}

function centsToAmount(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new CheckoutError("The order total exceeds the supported range.");
  }
  return (cents / 100).toFixed(2);
}

export async function reserveFifoStock(
  tx: CheckoutTransaction,
  orderItemId: string,
  variantId: string,
  quantity: number,
  orderNumber: string,
) {
  const batches = await tx.inventoryBatch.findMany({
    where: { variantId, quantityRemaining: { gt: 0 } },
    orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      warehouseId: true,
      quantityRemaining: true,
    },
  });
  let remaining = quantity;
  const allocations: Array<{ batchId: string; warehouseId: string; quantity: number }> = [];
  for (const batch of batches) {
    if (remaining === 0) break;
    const allocation = Math.min(batch.quantityRemaining, remaining);
    const changed = await tx.inventoryBatch.updateMany({
      where: { id: batch.id, quantityRemaining: { gte: allocation } },
      data: { quantityRemaining: { decrement: allocation } },
    });
    if (changed.count !== 1) {
      throw new CheckoutError("Stock changed during checkout. Please try again.");
    }
    allocations.push({ batchId: batch.id, warehouseId: batch.warehouseId, quantity: allocation });
    remaining -= allocation;
  }
  if (remaining > 0) {
    throw new CheckoutError("Available stock changed during checkout. Please try again.");
  }

  const changedVariant = await tx.productVariant.updateMany({
    where: { id: variantId, stockOnHand: { gte: quantity } },
    data: { stockOnHand: { decrement: quantity } },
  });
  if (changedVariant.count !== 1) {
    throw new CheckoutError("Available stock changed during checkout. Please try again.");
  }

  await tx.orderItemBatch.createMany({
    data: allocations.map((allocation) => ({
      orderItemId,
      batchId: allocation.batchId,
      quantity: allocation.quantity,
    })),
  });
  await tx.stockAdjustment.createMany({
    data: allocations.map((allocation) => ({
      variantId,
      warehouseId: allocation.warehouseId,
      batchId: allocation.batchId,
      createdById: null,
      type: "ORDER_RESERVED",
      quantityChange: -allocation.quantity,
      note: `Reserved for order ${orderNumber}`,
    })),
  });
}

export async function reserveDigitalLicenseKeys(
  tx: CheckoutTransaction,
  orderItemId: string,
  productId: string,
  variantId: string,
  quantity: number,
) {
  const keys = await tx.digitalAsset.findMany({
    where: {
      productId,
      type: "LICENSE_KEY",
      isAvailable: true,
      OR: [{ variantId }, { variantId: null }],
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: quantity,
    select: { id: true },
  });
  if (keys.length !== quantity) {
    throw new CheckoutError("Digital license stock changed during checkout. Please try again.");
  }
  const changed = await tx.digitalAsset.updateMany({
    where: { id: { in: keys.map((key) => key.id) }, isAvailable: true },
    data: { isAvailable: false },
  });
  if (changed.count !== quantity) {
    throw new CheckoutError("Digital license stock changed during checkout. Please try again.");
  }
  await tx.orderItemDigitalAsset.createMany({
    data: keys.map((key) => ({ orderItemId, assetId: key.id })),
  });
}

async function createOrderInTransaction(
  tx: CheckoutTransaction,
  details: CheckoutDetails,
  cart: readonly CheckoutLineInput[],
) {
  if (details.idempotencyKey) {
    const existing = await tx.order.findUnique({
      where: { idempotencyKey: details.idempotencyKey },
      select: { id: true, orderNumber: true, total: true },
    });
    if (existing) {
      return { id: existing.id, orderNumber: existing.orderNumber, total: existing.total.toString() };
    }
  }

  const settings = await tx.generalSettings.update({
    where: { id: "store" },
    data: { nextOrderSequence: { increment: 1 } },
    select: {
      orderNumberPrefix: true,
      nextOrderSequence: true,
      autoMoveToPending: true,
      freeDeliveryAboveBDT: true,
    },
  });
  const sequence = settings.nextOrderSequence;
  if (!Number.isSafeInteger(sequence) || sequence <= 0) {
    throw new CheckoutError("Order numbering is not configured correctly.");
  }

  const variantIds = cart.map((line) => line.variantId);
  const variants = await tx.productVariant.findMany({
    where: {
      id: { in: variantIds },
      isActive: true,
      product: { isActive: true },
    },
    include: {
      product: {
        include: {
          shippingClass: { select: { id: true, surcharge: true, isActive: true } },
        },
      },
    },
  });
  if (variants.length !== cart.length) {
    throw new CheckoutError("A selected product is no longer available.");
  }
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  const lines = cart.map((item) => {
    const variant = variantById.get(item.variantId);
    if (!variant) throw new CheckoutError("A selected product is no longer available.");
    return { ...item, variant };
  });

  for (const { quantity, variant } of lines) {
    if (variant.product.type !== "DIGITAL") continue;
    const assetScope = {
      productId: variant.productId,
      OR: [{ variantId: variant.id }, { variantId: null }],
    };
    const [licenseCount, availableLicenseCount, availableDownloadCount] = await Promise.all([
      tx.digitalAsset.count({ where: { ...assetScope, type: "LICENSE_KEY" } }),
      tx.digitalAsset.count({ where: { ...assetScope, type: "LICENSE_KEY", isAvailable: true } }),
      tx.digitalAsset.count({ where: { ...assetScope, type: "DOWNLOAD", isAvailable: true } }),
    ]);
    if (licenseCount > 0 && availableLicenseCount < quantity) {
      throw new CheckoutError("This digital product does not have enough available license keys.");
    }
    if (licenseCount === 0 && availableDownloadCount === 0) {
      throw new CheckoutError("This digital product is not ready for checkout.");
    }
  }

  const shortages = lines.filter(({ quantity, variant }) =>
    variant.product.type === "PHYSICAL" && variant.stockOnHand < quantity,
  );
  const disallowedShortages = shortages.filter(({ variant }) => !variant.product.allowPreorder);
  if (disallowedShortages.length > 0) {
    throw new CheckoutError("One or more products do not have enough stock. Update your cart to continue.");
  }
  const hasPreorder = shortages.length > 0;
  const reserveStock = !hasPreorder;

  const subtotalCents = lines.reduce(
    (sum, { quantity, variant }) => sum + amountToCents(variant.price) * quantity,
    0,
  );
  if (!Number.isSafeInteger(subtotalCents)) {
    throw new CheckoutError("Order subtotal exceeds the supported range.");
  }
  const subtotal = subtotalCents / 100;
  const normalizedPhone = normalizeCustomerPhone(details.customerPhone);
  const customer = normalizedPhone
    ? await tx.customer.upsert({
      where: { phone: normalizedPhone },
      create: {
        phone: normalizedPhone,
        name: details.customerName,
        email: details.customerEmail,
      },
      update: {
        name: details.customerName,
        ...(details.customerEmail ? { email: details.customerEmail } : {}),
      },
      select: { id: true },
    })
    : null;

  let offer: {
    id: string;
    promoCode: string | null;
    discountType: "FIXED" | "PERCENTAGE" | null;
    discountValue: Prisma.Decimal | null;
  } | null = null;
  let discountAmount = 0;
  if (details.promoCode) {
    offer = await tx.offer.findFirst({
      where: {
        promoCode: details.promoCode,
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: new Date() } }] },
        ],
      },
      select: {
        id: true,
        promoCode: true,
        discountType: true,
        discountValue: true,
      },
    });
    if (!offer?.discountType || offer.discountValue === null) {
      throw new CheckoutError("That promo code is invalid or has expired.");
    }
    discountAmount = calculateOfferDiscount(subtotal, offer.discountType, offer.discountValue.toString());
  }

  let shippingCharge = 0;
  const physicalLines = lines.filter(({ variant }) => variant.product.type === "PHYSICAL");
  if (physicalLines.length > 0 && details.deliveryZone) {
    const [rate, standardClass] = await Promise.all([
      tx.deliveryRate.findUnique({ where: { zone: details.deliveryZone } }),
      tx.shippingClass.findUnique({
        where: { code: "STANDARD" },
        select: { id: true, surcharge: true, isActive: true },
      }),
    ]);
    if (!rate?.isActive) {
      throw new CheckoutError("Delivery is not available for the selected area.");
    }
    shippingCharge = calculateShippingCharge(
      physicalLines.map(({ quantity, variant }) => {
        const shippingClass = variant.product.shippingClass?.isActive
          ? variant.product.shippingClass
          : standardClass?.isActive ? standardClass : null;
        return {
          productType: variant.product.type,
          quantity,
          weightGrams: variant.product.weightGrams,
          shippingClassId: shippingClass?.id ?? null,
          shippingSurcharge: shippingClass?.surcharge.toString() ?? null,
        };
      }),
      {
        baseCharge: rate.baseCharge.toString(),
        includedWeightGrams: rate.includedWeightGrams,
        extraPerKgCharge: rate.extraPerKgCharge.toString(),
      },
      subtotal,
      settings.freeDeliveryAboveBDT?.toNumber() ?? null,
    );
  }

  const shippingCents = amountToCents(shippingCharge);
  const discountCents = amountToCents(discountAmount);
  const totalCents = subtotalCents - discountCents + shippingCents;
  const orderNumber = formatOrderNumber(settings.orderNumberPrefix, sequence);
  const orderStatus = hasPreorder && settings.autoMoveToPending
    ? "PENDING"
    : details.paymentMethod === "COD" || details.paymentMethod === "CASH"
      ? "CONFIRMED"
      : "AWAITING_PAYMENT";

  const order = await tx.order.create({
    data: {
      orderNumber,
      status: orderStatus,
      paymentMethod: details.paymentMethod,
      paymentState: details.paymentMethod === "CASH" ? "SUCCEEDED" : "PENDING",
      customerName: details.customerName,
      customerPhone: details.customerPhone ?? "",
      customerEmail: details.customerEmail,
      address: details.address ?? "In-store sale",
      area: details.area,
      city: details.city ?? "Counter",
      deliveryZone: details.deliveryZone,
      source: details.source ?? "WEB",
      customerId: customer?.id,
      createdById: details.createdById ?? null,
      idempotencyKey: details.idempotencyKey,
      subtotal: centsToAmount(subtotalCents),
      shippingCharge: centsToAmount(shippingCents),
      discountAmount: centsToAmount(discountCents),
      total: centsToAmount(totalCents),
      currencyCode: "BDT",
      hasPreorder,
      offerId: offer?.id,
      appliedPromoCode: offer?.promoCode,
      statusHistory: {
        create: {
          fromStatus: null,
          toStatus: orderStatus,
          note: details.source && details.source !== "WEB" ? `Created from ${details.source} source.` : "Order created.",
          authorId: details.createdById ?? null,
        },
      },
      items: {
        create: lines.map(({ quantity, variant }) => {
          const unitPriceCents = amountToCents(variant.price);
          const isPreorder = variant.product.type === "PHYSICAL" && variant.stockOnHand < quantity;
          return {
            productId: variant.productId,
            variantId: variant.id,
            productName: variant.product.name,
            sku: variant.sku,
            quantity,
            reservedQuantity: 0,
            unitPrice: centsToAmount(unitPriceCents),
            lineTotal: centsToAmount(unitPriceCents * quantity),
            weightGrams: variant.product.weightGrams,
            isPreorder,
          };
        }),
      },
      paymentAttempts: {
        create: {
          method: details.paymentMethod,
          state: details.paymentMethod === "CASH" ? "SUCCEEDED" : "PENDING",
          amount: centsToAmount(totalCents),
          idempotencyKey: randomUUID(),
        },
      },
    },
    include: { items: { select: { id: true, variantId: true, quantity: true, isPreorder: true } } },
  });

  if (reserveStock) {
    for (const item of order.items) {
      const line = lines.find(({ variant }) => variant.id === item.variantId);
      if (!line) continue;
      if (line.variant.product.type === "PHYSICAL") {
        await reserveFifoStock(tx, item.id, item.variantId, item.quantity, order.orderNumber);
        await tx.orderItem.update({
          where: { id: item.id },
          data: { reservedQuantity: item.quantity },
        });
      } else {
        const licenseCount = await tx.digitalAsset.count({
          where: {
            productId: line.variant.productId,
            type: "LICENSE_KEY",
            OR: [{ variantId: line.variant.id }, { variantId: null }],
          },
        });
        if (licenseCount > 0) {
          await reserveDigitalLicenseKeys(
            tx,
            item.id,
            line.variant.productId,
            line.variant.id,
            item.quantity,
          );
        }
      }
    }
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    total: order.total.toString(),
  };
}

export async function createCheckoutOrder(
  details: CheckoutDetails,
  cart: readonly CheckoutLineInput[],
) {
  if (cart.length === 0) {
    throw new CheckoutError("Your cart is empty.");
  }
  try {
    return await getPrisma().$transaction(
      (tx) => createOrderInTransaction(tx, details, cart),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      throw new CheckoutError("Stock is being updated. Please retry checkout.");
    }
    if (
      details.idempotencyKey &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const target = error.meta?.target;
      const isIdempotencyConflict = Array.isArray(target)
        ? target.includes("idempotency_key")
        : target === "orders_idempotency_key_key";
      if (isIdempotencyConflict) {
        const existing = await getPrisma().order.findUnique({
          where: { idempotencyKey: details.idempotencyKey },
          select: { id: true, orderNumber: true, total: true },
        });
        if (existing) {
          return { id: existing.id, orderNumber: existing.orderNumber, total: existing.total.toString() };
        }
      }
    }
    throw error;
  }
}
