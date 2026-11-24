import { Prisma } from "@/generated/prisma/client";
import type {
  OrderStatus,
  Prisma as PrismaTypes,
} from "@/generated/prisma/client";
import {
  reserveDigitalLicenseKeys,
  reserveFifoStock,
} from "@/lib/checkout/order";
import { writeActivityLog } from "@/lib/accounting/service";
import { getPrisma } from "@/lib/prisma";
import { getAllowedOrderStatusTransitions } from "./status";

type OrderTransaction = PrismaTypes.TransactionClient;

async function releaseReservations(
  tx: OrderTransaction,
  orderId: string,
  actorId: string,
  orderNumber: string,
) {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    include: {
      batches: { include: { batch: true } },
      digitalAssets: { select: { assetId: true } },
    },
  });

  for (const item of items) {
    for (const allocation of item.batches) {
      const restored = await tx.inventoryBatch.updateMany({
        where: {
          id: allocation.batchId,
          quantityRemaining: {
            lte: allocation.batch.quantityReceived - allocation.quantity,
          },
        },
        data: { quantityRemaining: { increment: allocation.quantity } },
      });
      if (restored.count !== 1) {
        throw new Error("Reserved stock changed before cancellation; retry the operation.");
      }

      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stockOnHand: { increment: allocation.quantity } },
      });
      await tx.stockAdjustment.create({
        data: {
          variantId: item.variantId,
          warehouseId: allocation.batch.warehouseId,
          batchId: allocation.batchId,
          createdById: actorId,
          type: "ORDER_RELEASED",
          quantityChange: allocation.quantity,
          note: `Released for cancelled order ${orderNumber}`,
        },
      });
    }

    const assetIds = item.digitalAssets.map(({ assetId }) => assetId);
    if (assetIds.length) {
      const released = await tx.digitalAsset.updateMany({
        where: { id: { in: assetIds }, isAvailable: false },
        data: { isAvailable: true },
      });
      if (released.count !== assetIds.length) {
        throw new Error("Reserved digital assets changed before cancellation.");
      }
    }
    if (item.reservedQuantity > 0) {
      await tx.orderItem.update({
        where: { id: item.id },
        data: { reservedQuantity: 0 },
      });
    }
  }
}

async function reservePendingOrder(
  tx: OrderTransaction,
  order: {
    id: string;
    orderNumber: string;
    items: Array<{
      id: string;
      variantId: string;
      productId: string;
      quantity: number;
      product: { type: "PHYSICAL" | "DIGITAL" };
    }>;
  },
) {
  for (const item of order.items) {
    if (item.product.type === "PHYSICAL") {
      const variant = await tx.productVariant.findUnique({
        where: { id: item.variantId },
        select: { stockOnHand: true },
      });
      if (!variant || variant.stockOnHand < item.quantity) {
        throw new Error(`Not enough stock to confirm order ${order.orderNumber}.`);
      }
      await reserveFifoStock(tx, item.id, item.variantId, item.quantity, order.orderNumber);
      await tx.orderItem.update({
        where: { id: item.id },
        data: { reservedQuantity: item.quantity, isPreorder: false },
      });
      continue;
    }

    const licenseCount = await tx.digitalAsset.count({
      where: {
        productId: item.productId,
        type: "LICENSE_KEY",
        OR: [{ variantId: item.variantId }, { variantId: null }],
      },
    });
    if (licenseCount > 0) {
      await reserveDigitalLicenseKeys(tx, item.id, item.productId, item.variantId, item.quantity);
    }
  }
}

export async function updateOrderStatus(input: {
  orderId: string;
  nextStatus: OrderStatus;
  actorId: string;
  note?: string;
}) {
  return getPrisma().$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: input.orderId },
      include: {
        items: {
          select: {
            id: true,
            variantId: true,
            productId: true,
            quantity: true,
            product: { select: { type: true } },
          },
        },
        courierBookings: {
          where: { status: { in: ["BOOKED", "IN_TRANSIT"] } },
          select: { id: true },
        },
      },
    });
    if (!order) throw new Error("Order was not found.");
    if (order.status === input.nextStatus) return order;
    if (!getAllowedOrderStatusTransitions(order.status).includes(input.nextStatus)) {
      throw new Error(`Order cannot move from ${order.status} to ${input.nextStatus}.`);
    }

    if (input.nextStatus === "CONFIRMED") {
      if (order.paymentMethod !== "COD" && order.paymentState !== "SUCCEEDED") {
        throw new Error("Do not confirm an unpaid order. Wait for verified payment.");
      }
      if (order.status === "PENDING") await reservePendingOrder(tx, order);
    }
    if (input.nextStatus === "CANCELLED") {
      if (order.paymentState === "SUCCEEDED") {
        throw new Error("This paid order needs a recorded refund before it can be cancelled.");
      }
      if (order.courierBookings.length) {
        throw new Error("Cancel the active courier booking before cancelling this order.");
      }
      await releaseReservations(tx, order.id, input.actorId, order.orderNumber);
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: input.nextStatus,
        ...(input.nextStatus === "CONFIRMED" && order.status === "PENDING"
          ? { hasPreorder: false }
          : {}),
      },
    });
    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        authorId: input.actorId,
        fromStatus: order.status,
        toStatus: input.nextStatus,
        note: input.note || null,
      },
    });
    await writeActivityLog(tx, {
      actorId: input.actorId,
      action: "ORDER_STATUS_CHANGED",
      entityType: "Order",
      entityId: order.id,
      summary: `Order ${order.orderNumber} moved from ${order.status} to ${input.nextStatus}.`,
      details: { orderNumber: order.orderNumber, fromStatus: order.status, toStatus: input.nextStatus },
    });
    return { ...order, status: input.nextStatus };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
