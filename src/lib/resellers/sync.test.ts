import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "../../generated/prisma/client";
import type { NormalizedResellerProduct } from "./adapter";
import { upsertResellerProductInTransaction } from "./sync";

function createMemoryTransaction() {
  const products = new Map<string, Record<string, unknown>>();
  const variants = new Map<string, Record<string, unknown>>();
  const batches: Array<Record<string, unknown>> = [];
  const adjustments: Array<Record<string, unknown>> = [];

  const transaction = {
    product: {
      findUnique: async ({ where }: {
        where: {
          externalSourceId_externalProductId: {
            externalSourceId: string;
            externalProductId: string;
          };
        };
      }) => {
        const key = `${where.externalSourceId_externalProductId.externalSourceId}\0${where.externalSourceId_externalProductId.externalProductId}`;
        const product = products.get(key);
        return product ? { id: product.id } : null;
      },
      upsert: async ({ where, create, update }: {
        where: {
          externalSourceId_externalProductId: {
            externalSourceId: string;
            externalProductId: string;
          };
        };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const key = `${where.externalSourceId_externalProductId.externalSourceId}\0${where.externalSourceId_externalProductId.externalProductId}`;
        const current = products.get(key);
        const product = current
          ? { ...current, ...update }
          : { ...create, id: `product-${products.size + 1}` };
        products.set(key, product);
        return { id: product.id };
      },
    },
    productVariant: {
      findUnique: async ({ where }: {
        where: {
          productId_externalVariantId?: {
            productId: string;
            externalVariantId: string;
          };
          id?: string;
        };
      }) => {
        if (where.productId_externalVariantId) {
          const key = `${where.productId_externalVariantId.productId}\0${where.productId_externalVariantId.externalVariantId}`;
          const variant = variants.get(key);
          return variant ? { id: variant.id } : null;
        }

        const variant = [...variants.values()].find(({ id }) => id === where.id);
        return variant
          ? { id: variant.id, stockOnHand: variant.stockOnHand }
          : null;
      },
      upsert: async ({ where, create, update }: {
        where: {
          productId_externalVariantId: {
            productId: string;
            externalVariantId: string;
          };
        };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const key = `${where.productId_externalVariantId.productId}\0${where.productId_externalVariantId.externalVariantId}`;
        const current = variants.get(key);
        const variant = current
          ? { ...current, ...update }
          : { ...create, id: `variant-${variants.size + 1}`, stockOnHand: 0 };
        variants.set(key, variant);
        return { id: variant.id };
      },
      update: async ({ where, data }: {
        where: { id: string };
        data: { stockOnHand: { increment: number } };
      }) => {
        const variant = [...variants.values()].find(({ id }) => id === where.id);
        assert.ok(variant);
        variant.stockOnHand = Number(variant.stockOnHand) + data.stockOnHand.increment;
        return variant;
      },
    },
    inventoryBatch: {
      aggregate: async ({ where }: { where: { variantId: string } }) => ({
        _sum: {
          quantityRemaining: batches
            .filter((batch) => batch.variantId === where.variantId)
            .reduce((sum, batch) => sum + Number(batch.quantityRemaining), 0),
        },
      }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const batch = { ...data, id: `batch-${batches.length + 1}` };
        batches.push(batch);
        return batch;
      },
    },
    warehouse: {
      findUnique: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        isActive: true,
      }),
    },
    stockAdjustment: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const adjustment = { ...data, id: `adjustment-${adjustments.length + 1}` };
        adjustments.push(adjustment);
        return adjustment;
      },
    },
    productImage: {
      deleteMany: async () => ({ count: 0 }),
    },
  } as unknown as Prisma.TransactionClient;

  return { transaction, products, variants, batches, adjustments };
}

describe("upsertResellerProductInTransaction", () => {
  it("updates the existing external product on repeat sync without duplicating variants or stock", async () => {
    const memory = createMemoryTransaction();
    const firstPayload: NormalizedResellerProduct = {
      externalProductId: "supplier-42",
      title: "First title",
      description: null,
      images: [],
      variants: [{
        externalVariantId: "variant-blue",
        externalSku: "SUP-BLUE",
        name: "Blue",
        size: null,
        color: "Blue",
        stock: 5,
        supplierPrice: "10.00",
      }],
    };
    const updatedPayload: NormalizedResellerProduct = {
      ...firstPayload,
      title: "Updated title",
      variants: [{
        ...firstPayload.variants[0],
        stock: 5,
        supplierPrice: "11.00",
      }],
    };

    const firstSync = await upsertResellerProductInTransaction(
      memory.transaction,
      "source-1",
      "FIXED",
      "2.00",
      "main",
      "staff-1",
      firstPayload,
    );
    const secondSync = await upsertResellerProductInTransaction(
      memory.transaction,
      "source-1",
      "FIXED",
      "2.00",
      "main",
      "staff-1",
      updatedPayload,
    );

    assert.equal(firstSync.created, true);
    assert.equal(firstSync.variantsCreated, 1);
    assert.equal(firstSync.stockUnitsChanged, 5);
    assert.equal(secondSync.created, false);
    assert.equal(secondSync.variantsCreated, 0);
    assert.equal(secondSync.stockUnitsChanged, 0);
    assert.equal(memory.products.size, 1);
    assert.equal(memory.variants.size, 1);
    assert.equal(memory.batches.length, 1);
    assert.equal(memory.adjustments.length, 1);
    assert.equal([...memory.variants.values()][0].stockOnHand, 5);
    assert.equal([...memory.products.values()][0].name, "Updated title");
    assert.equal([...memory.products.values()][0].price, "13.00");
    assert.equal([...memory.variants.values()][0].price, "13.00");
  });
});
