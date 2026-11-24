import { Prisma } from "@/generated/prisma/client";
import type {
  Prisma as PrismaTypes,
  StockAdjustmentType,
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";
import { writeActivityLog } from "@/lib/accounting/service";
import { planFifoConsumption } from "./fifo";

type Transaction = PrismaTypes.TransactionClient;

export type StockDelta = {
  variantId: string;
  warehouseId: string;
  createdById: string;
  quantityChange: number;
  unitCost?: string;
  batchCode?: string;
  purchaseOrderItemId?: string;
  type: StockAdjustmentType;
  note?: string;
};

async function consumeFifo(
  tx: Transaction,
  variantId: string,
  warehouseId: string,
  quantity: number,
) {
  const batches = await tx.inventoryBatch.findMany({
    where: {
      variantId,
      warehouseId,
      quantityRemaining: { gt: 0 },
    },
    orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      quantityRemaining: true,
      unitCost: true,
      receivedAt: true,
    },
  });
  const allocations = planFifoConsumption(batches, quantity);

  for (const allocation of allocations) {
    const updated = await tx.inventoryBatch.updateMany({
      where: {
        id: allocation.batchId,
        quantityRemaining: { gte: allocation.quantity },
      },
      data: { quantityRemaining: { decrement: allocation.quantity } },
    });

    if (updated.count !== 1) {
      throw new Error("Stock changed during FIFO consumption; retry the operation.");
    }
  }

  return allocations;
}

export async function applyStockDeltaInTransaction(
  tx: Transaction,
  input: StockDelta,
) {
  if (!Number.isSafeInteger(input.quantityChange) || input.quantityChange === 0) {
    throw new Error("Stock adjustment must be a non-zero whole number.");
  }

  const [variant, warehouse, balance] = await Promise.all([
    tx.productVariant.findUnique({
      where: { id: input.variantId },
      select: { id: true, stockOnHand: true },
    }),
    tx.warehouse.findUnique({
      where: { id: input.warehouseId },
      select: { id: true, isActive: true },
    }),
    tx.inventoryBatch.aggregate({
      where: { variantId: input.variantId },
      _sum: { quantityRemaining: true },
    }),
  ]);

  if (!variant) {
    throw new Error("Product variant was not found.");
  }
  if (!warehouse?.isActive) {
    throw new Error("Select an active warehouse.");
  }
  if ((balance._sum.quantityRemaining ?? 0) !== variant.stockOnHand) {
    throw new Error("Variant stock does not match its inventory batches.");
  }

  if (input.quantityChange > 0) {
    if (input.unitCost === undefined) {
      throw new Error("Unit cost is required when receiving stock.");
    }

    const batch = await tx.inventoryBatch.create({
      data: {
        variantId: input.variantId,
        warehouseId: input.warehouseId,
        batchCode: input.batchCode,
        purchaseOrderItemId: input.purchaseOrderItemId,
        quantityReceived: input.quantityChange,
        quantityRemaining: input.quantityChange,
        unitCost: input.unitCost,
      },
    });

    await tx.productVariant.update({
      where: { id: input.variantId },
      data: { stockOnHand: { increment: input.quantityChange } },
    });

    return tx.stockAdjustment.create({
      data: {
        variantId: input.variantId,
        warehouseId: input.warehouseId,
        batchId: batch.id,
        createdById: input.createdById,
        type: input.type,
        quantityChange: input.quantityChange,
        note: input.note,
      },
    });
  }

  const quantity = Math.abs(input.quantityChange);
  if (variant.stockOnHand < quantity) {
    throw new Error("Adjustment would reduce total variant stock below zero.");
  }

  const allocations = await consumeFifo(
    tx,
    input.variantId,
    input.warehouseId,
    quantity,
  );
  const updated = await tx.productVariant.updateMany({
    where: {
      id: input.variantId,
      stockOnHand: { gte: quantity },
    },
    data: { stockOnHand: { decrement: quantity } },
  });
  if (updated.count !== 1) {
    throw new Error("Stock changed during adjustment; retry the operation.");
  }

  return tx.stockAdjustment.createMany({
    data: allocations.map((allocation) => ({
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      createdById: input.createdById,
      batchId: allocation.batchId,
      type: input.type,
      quantityChange: -allocation.quantity,
      note: input.note,
    })),
  });
}

export async function adjustStock(input: StockDelta) {
  return getPrisma().$transaction(async (tx) => {
    const result = await applyStockDeltaInTransaction(tx, input);
    await writeActivityLog(tx, {
      actorId: input.createdById,
      action: "STOCK_ADJUSTED",
      entityType: "ProductVariant",
      entityId: input.variantId,
      summary: `Adjusted stock by ${input.quantityChange} units (${input.type}).`,
      details: {
        warehouseId: input.warehouseId,
        quantityChange: input.quantityChange,
        adjustmentType: input.type,
      },
    });
    return result;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function transferStock(input: {
  variantId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  createdById: string;
  quantity: number;
  note?: string;
}) {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new Error("Choose two different warehouses for a stock transfer.");
  }
  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
    throw new Error("Transfer quantity must be a positive whole number.");
  }

  return getPrisma().$transaction(async (tx) => {
    const [variant, source, destination, total] = await Promise.all([
      tx.productVariant.findUnique({
        where: { id: input.variantId },
        select: { id: true, stockOnHand: true },
      }),
      tx.warehouse.findUnique({
        where: { id: input.fromWarehouseId },
        select: { id: true, isActive: true },
      }),
      tx.warehouse.findUnique({
        where: { id: input.toWarehouseId },
        select: { id: true, isActive: true },
      }),
      tx.inventoryBatch.aggregate({
        where: { variantId: input.variantId },
        _sum: { quantityRemaining: true },
      }),
    ]);

    if (!variant) {
      throw new Error("Product variant was not found.");
    }
    if (!source?.isActive || !destination?.isActive) {
      throw new Error("Both warehouses must be active.");
    }
    if ((total._sum.quantityRemaining ?? 0) !== variant.stockOnHand) {
      throw new Error("Variant stock does not match its inventory batches.");
    }

    const allocations = await consumeFifo(
      tx,
      input.variantId,
      input.fromWarehouseId,
      input.quantity,
    );
    const transfer = await tx.stockTransfer.create({
      data: {
        variantId: input.variantId,
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        createdById: input.createdById,
        quantity: input.quantity,
        note: input.note,
      },
    });

    for (const allocation of allocations) {
      const destinationBatch = await tx.inventoryBatch.create({
        data: {
          variantId: input.variantId,
          warehouseId: input.toWarehouseId,
          batchCode: `TR-${transfer.id.slice(-12)}`,
          quantityReceived: allocation.quantity,
          quantityRemaining: allocation.quantity,
          unitCost: allocation.unitCost,
          receivedAt: allocation.receivedAt,
        },
      });

      await tx.stockTransferBatch.create({
        data: {
          transferId: transfer.id,
          sourceBatchId: allocation.batchId,
          destinationBatchId: destinationBatch.id,
          quantity: allocation.quantity,
        },
      });
    }

    await tx.stockAdjustment.createMany({
      data: [
        {
          variantId: input.variantId,
          warehouseId: input.fromWarehouseId,
          createdById: input.createdById,
          type: "TRANSFER_OUT",
          quantityChange: -input.quantity,
          note: input.note,
        },
        {
          variantId: input.variantId,
          warehouseId: input.toWarehouseId,
          createdById: input.createdById,
          type: "TRANSFER_IN",
          quantityChange: input.quantity,
          note: input.note,
        },
      ],
    });

    await writeActivityLog(tx, {
      actorId: input.createdById,
      action: "STOCK_TRANSFERRED",
      entityType: "StockTransfer",
      entityId: transfer.id,
      summary: `Transferred ${input.quantity} units between warehouses.`,
      details: {
        variantId: input.variantId,
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        quantity: input.quantity,
      },
    });

    return transfer;
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}
