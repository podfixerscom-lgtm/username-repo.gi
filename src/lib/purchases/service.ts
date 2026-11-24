import { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { writeActivityLog } from "@/lib/accounting/service";
import { applyStockDeltaInTransaction } from "@/lib/inventory/service";

export async function receivePurchaseOrderItem(input: {
  purchaseOrderItemId: string;
  warehouseId: string;
  createdById: string;
  quantity: number;
}) {
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
    throw new Error("Received quantity must be a positive whole number.");
  }

  return getPrisma().$transaction(async (tx) => {
    const item = await tx.purchaseOrderItem.findUnique({
      where: { id: input.purchaseOrderItemId },
      include: {
        purchaseOrder: { select: { id: true, status: true } },
      },
    });
    if (!item || item.purchaseOrder.status === "CANCELLED") {
      throw new Error("This purchase order item cannot receive stock.");
    }
    if (item.quantityReceived + input.quantity > item.quantityOrdered) {
      throw new Error("Received quantity cannot exceed the ordered quantity.");
    }

    await applyStockDeltaInTransaction(tx, {
      variantId: item.variantId,
      warehouseId: input.warehouseId,
      createdById: input.createdById,
      quantityChange: input.quantity,
      unitCost: item.unitCost.toFixed(2),
      batchCode: `PO-${item.purchaseOrderId.slice(-10).toUpperCase()}`,
      purchaseOrderItemId: item.id,
      type: "RECEIVE",
      note: `Received against purchase order ${item.purchaseOrderId}`,
    });

    const updated = await tx.purchaseOrderItem.updateMany({
      where: {
        id: item.id,
        quantityReceived: { lte: item.quantityOrdered - input.quantity },
      },
      data: { quantityReceived: { increment: input.quantity } },
    });
    if (updated.count !== 1) {
      throw new Error("Purchase quantity changed during receiving; retry the operation.");
    }

    const totals = await tx.purchaseOrderItem.aggregate({
      where: { purchaseOrderId: item.purchaseOrderId },
      _sum: { quantityOrdered: true, quantityReceived: true },
    });
    const ordered = totals._sum.quantityOrdered ?? 0;
    const received = totals._sum.quantityReceived ?? 0;
    const status = received === ordered
      ? "RECEIVED"
      : received > 0 ? "PARTIALLY_RECEIVED" : "ORDERED";
    await tx.purchaseOrder.update({
      where: { id: item.purchaseOrderId },
      data: { status },
    });

    await writeActivityLog(tx, {
      actorId: input.createdById,
      action: "PURCHASE_STOCK_RECEIVED",
      entityType: "PurchaseOrder",
      entityId: item.purchaseOrderId,
      summary: `Received ${input.quantity} units against purchase order ${item.purchaseOrderId}.`,
      details: {
        purchaseOrderItemId: item.id,
        warehouseId: input.warehouseId,
        quantity: input.quantity,
        unitCost: item.unitCost.toFixed(2),
      },
    });

    return { status, quantityReceived: item.quantityReceived + input.quantity };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
