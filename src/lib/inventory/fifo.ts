import type { InventoryBatch } from "@/generated/prisma/client";

export type FifoBatch = Pick<
  InventoryBatch,
  "id" | "quantityRemaining" | "unitCost" | "receivedAt"
>;

export type FifoAllocation = {
  batchId: string;
  quantity: number;
  unitCost: InventoryBatch["unitCost"];
  receivedAt: Date;
};

export function planFifoConsumption(
  batches: readonly FifoBatch[],
  requestedQuantity: number,
): FifoAllocation[] {
  if (!Number.isSafeInteger(requestedQuantity) || requestedQuantity <= 0) {
    throw new Error("FIFO consumption quantity must be a positive whole number.");
  }

  let remaining = requestedQuantity;
  const allocations: FifoAllocation[] = [];
  const orderedBatches = [...batches].sort((left, right) => {
    const timeDifference =
      left.receivedAt.getTime() - right.receivedAt.getTime();
    return timeDifference || left.id.localeCompare(right.id);
  });

  for (const batch of orderedBatches) {
    if (batch.quantityRemaining <= 0) {
      continue;
    }

    const quantity = Math.min(batch.quantityRemaining, remaining);
    allocations.push({
      batchId: batch.id,
      quantity,
      unitCost: batch.unitCost,
      receivedAt: batch.receivedAt,
    });
    remaining -= quantity;

    if (remaining === 0) {
      return allocations;
    }
  }

  throw new Error("Insufficient FIFO stock in the selected warehouse.");
}
