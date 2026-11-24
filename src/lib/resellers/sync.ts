import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import type { NormalizedResellerProduct } from "./adapter";
import { fetchResellerProducts } from "./adapter";
import { decryptSecret } from "@/lib/security/secrets";
import { getPrisma } from "@/lib/prisma";
import { calculateRetailPrice } from "@/lib/inventory/pricing";
import { applyStockDeltaInTransaction } from "@/lib/inventory/service";

const RESELLER_STOCK_NOTE = "Quantity reconciled from reseller API.";

function createResellerSlug(
  title: string,
  sourceId: string,
  externalProductId: string,
): string {
  const titleSlug = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  const suffix = createHash("sha256")
    .update(`${sourceId}\0${externalProductId}`)
    .digest("hex")
    .slice(0, 16);

  return `rs-${titleSlug || "product"}-${suffix}`;
}

function createLocalSku(
  sourceId: string,
  externalProductId: string,
  externalVariantId: string,
): string {
  const suffix = createHash("sha256")
    .update(`${sourceId}\0${externalProductId}\0${externalVariantId}`)
    .digest("hex")
    .slice(0, 24)
    .toUpperCase();

  return `RS-${suffix}`;
}

async function reconcileResellerStock(
  tx: Prisma.TransactionClient,
  input: {
    variantId: string;
    warehouseId: string;
    createdById: string;
    desiredStock: number;
    unitCost: string;
    externalProductId: string;
  },
): Promise<number> {
  const variant = await tx.productVariant.findUnique({
    where: { id: input.variantId },
    select: { stockOnHand: true },
  });
  if (!variant) {
    throw new Error("Imported product variant was not found.");
  }

  const delta = input.desiredStock - variant.stockOnHand;
  if (delta === 0) {
    return 0;
  }

  if (delta > 0) {
    await applyStockDeltaInTransaction(tx, {
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      createdById: input.createdById,
      quantityChange: delta,
      unitCost: input.unitCost,
      type: "RESELLER_SYNC",
      note: `${RESELLER_STOCK_NOTE} External product ${input.externalProductId}.`,
    });
    return delta;
  }

  let remaining = Math.abs(delta);
  let adjusted = 0;
  const batches = await tx.inventoryBatch.findMany({
    where: {
      variantId: input.variantId,
      quantityRemaining: { gt: 0 },
    },
    orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
    select: {
      warehouseId: true,
      quantityRemaining: true,
    },
  });

  for (const batch of batches) {
    const quantity = Math.min(batch.quantityRemaining, remaining);
    await applyStockDeltaInTransaction(tx, {
      variantId: input.variantId,
      warehouseId: batch.warehouseId,
      createdById: input.createdById,
      quantityChange: -quantity,
      type: "RESELLER_SYNC",
      note: `${RESELLER_STOCK_NOTE} External product ${input.externalProductId}.`,
    });
    remaining -= quantity;
    adjusted += quantity;
    if (remaining === 0) {
      return -adjusted;
    }
  }

  throw new Error("Unable to reconcile reseller stock from FIFO batches.");
}

export async function upsertResellerProductInTransaction(
  transaction: Prisma.TransactionClient,
  sourceId: string,
  sourceMarkupType: "FIXED" | "PERCENTAGE",
  sourceMarkupValue: string,
  mainWarehouseId: string,
  createdById: string,
  product: NormalizedResellerProduct,
) {
  return (async (tx: Prisma.TransactionClient) => {
    const where = {
      externalSourceId_externalProductId: {
        externalSourceId: sourceId,
        externalProductId: product.externalProductId,
      },
    };
    const existing = await tx.product.findUnique({
      where,
      select: { id: true },
    });
    const firstSupplierPrice = product.variants[0].supplierPrice;
    const firstRetailPrice = calculateRetailPrice(
      firstSupplierPrice,
      sourceMarkupType,
      sourceMarkupValue,
    );
    const now = new Date();
    const localProduct = await tx.product.upsert({
      where,
      create: {
        name: product.title,
        slug: createResellerSlug(
          product.title,
          sourceId,
          product.externalProductId,
        ),
        description: product.description,
        type: "PHYSICAL",
        price: firstRetailPrice,
        currencyCode: "BDT",
        externalSourceId: sourceId,
        externalProductId: product.externalProductId,
        supplierPrice: firstSupplierPrice,
        isResellerProduct: true,
        lastResellerSyncedAt: now,
      },
      update: {
        name: product.title,
        description: product.description,
        price: firstRetailPrice,
        supplierPrice: firstSupplierPrice,
        isResellerProduct: true,
        lastResellerSyncedAt: now,
      },
      select: { id: true },
    });

    let variantsCreated = 0;
    let stockUnitsChanged = 0;
    for (const externalVariant of product.variants) {
      const retailPrice = calculateRetailPrice(
        externalVariant.supplierPrice,
        sourceMarkupType,
        sourceMarkupValue,
      );
      const variantWhere = {
        productId_externalVariantId: {
          productId: localProduct.id,
          externalVariantId: externalVariant.externalVariantId,
        },
      };
      const variantExists = await tx.productVariant.findUnique({
        where: variantWhere,
        select: { id: true },
      });
      const variant = await tx.productVariant.upsert({
        where: variantWhere,
        create: {
          productId: localProduct.id,
          name: externalVariant.name,
          sku: createLocalSku(
            sourceId,
            product.externalProductId,
            externalVariant.externalVariantId,
          ),
          externalSku: externalVariant.externalSku,
          size: externalVariant.size,
          color: externalVariant.color,
          price: retailPrice,
          externalVariantId: externalVariant.externalVariantId,
        },
        update: {
          name: externalVariant.name,
          externalSku: externalVariant.externalSku,
          size: externalVariant.size,
          color: externalVariant.color,
          price: retailPrice,
        },
        select: { id: true },
      });
      if (!variantExists) {
        variantsCreated += 1;
      }

      stockUnitsChanged += await reconcileResellerStock(tx, {
        variantId: variant.id,
        warehouseId: mainWarehouseId,
        createdById,
        desiredStock: externalVariant.stock,
        unitCost: externalVariant.supplierPrice,
        externalProductId: product.externalProductId,
      });
    }

    const imageUrls = product.images.map((image) => image.url);
    for (const [index, image] of product.images.entries()) {
      await tx.productImage.upsert({
        where: {
          productId_url: {
            productId: localProduct.id,
            url: image.url,
          },
        },
        create: {
          productId: localProduct.id,
          externalSourceId: sourceId,
          url: image.url,
          altText: image.altText || `${product.title} image ${index + 1}`,
          sortOrder: index,
        },
        update: {
          externalSourceId: sourceId,
          altText: image.altText || `${product.title} image ${index + 1}`,
          sortOrder: index,
        },
      });
    }

    await tx.productImage.deleteMany({
      where: {
        productId: localProduct.id,
        externalSourceId: sourceId,
        ...(imageUrls.length > 0
          ? {
            url: { notIn: imageUrls },
          }
          : {}),
      },
    });

    return {
      created: !existing,
      variantsCreated,
      stockUnitsChanged,
    };
  })(transaction);
}

async function upsertImportedProduct(
  sourceId: string,
  sourceMarkupType: "FIXED" | "PERCENTAGE",
  sourceMarkupValue: string,
  mainWarehouseId: string,
  createdById: string,
  product: NormalizedResellerProduct,
) {
  return getPrisma().$transaction(
    (tx) => upsertResellerProductInTransaction(
      tx,
      sourceId,
      sourceMarkupType,
      sourceMarkupValue,
      mainWarehouseId,
      createdById,
      product,
    ),
    {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export async function testResellerConnection(sourceId: string) {
  const source = await getPrisma().resellerSource.findUnique({
    where: { id: sourceId },
  });
  if (!source?.isActive) {
    throw new Error("Active reseller source was not found.");
  }

  const products = await fetchResellerProducts(
    source,
    decryptSecret(source.encryptedApiKey),
    1,
  );
  return { productsFound: products.length };
}

export async function syncResellerSource(
  sourceId: string,
  createdById: string,
) {
  const source = await getPrisma().resellerSource.findUnique({
    where: { id: sourceId },
  });
  if (!source?.isActive) {
    throw new Error("Active reseller source was not found.");
  }

  const mainWarehouse = await getPrisma().warehouse.findUnique({
    where: { code: "MAIN" },
    select: { id: true },
  });
  if (!mainWarehouse) {
    throw new Error("Main warehouse is missing; run the database seed first.");
  }

  const products = await fetchResellerProducts(
    source,
    decryptSecret(source.encryptedApiKey),
  );
  let productsCreated = 0;
  let productsUpdated = 0;
  let variantsCreated = 0;
  let stockUnitsChanged = 0;

  for (const product of products) {
    const result = await upsertImportedProduct(
      source.id,
      source.markupType,
      source.markupValue.toString(),
      mainWarehouse.id,
      createdById,
      product,
    );
    productsCreated += Number(result.created);
    productsUpdated += Number(!result.created);
    variantsCreated += result.variantsCreated;
    stockUnitsChanged += result.stockUnitsChanged;
  }

  const lastSyncedAt = new Date();
  await getPrisma().resellerSource.update({
    where: { id: source.id },
    data: { lastSyncedAt },
  });

  return {
    productsCreated,
    productsUpdated,
    variantsCreated,
    stockUnitsChanged,
    lastSyncedAt,
  };
}
