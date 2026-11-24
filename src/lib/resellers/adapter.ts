import { z } from "zod";
import type { ResellerSource } from "@/generated/prisma/client";
import { assertPublicHttpsUrl, createProductsUrl } from "./safe-url";

const sourceIdentifierSchema = z.union([
  z.string().trim().min(1).max(180),
  z.number().int().safe().transform(String),
]);

const moneySchema = z.coerce
  .number()
  .finite()
  .min(0)
  .max(9_999_999_999.99);

const imageSchema = z.union([
  z.string().url().transform((url) => ({ url, altText: "" })),
  z.object({
    url: z.string().url(),
    alt_text: z.string().max(250).optional(),
    altText: z.string().max(250).optional(),
  }).transform((image) => ({
    url: image.url,
    altText: image.altText ?? image.alt_text ?? "",
  })),
]).refine((image) => {
  try {
    return new URL(image.url).protocol === "https:";
  } catch {
    return false;
  }
}, "Reseller image URL must use HTTPS.");

const resellerVariantSchema = z.object({
  id: sourceIdentifierSchema.optional(),
  external_variant_id: sourceIdentifierSchema.optional(),
  sku: z.string().trim().max(120).optional(),
  name: z.string().trim().max(120).optional(),
  size: z.string().trim().max(80).optional(),
  color: z.string().trim().max(80).optional(),
  stock: z.coerce.number().int().min(0).max(2_000_000_000).optional(),
  supplier_price: moneySchema.optional(),
});

const resellerProductSchema = z.object({
  id: sourceIdentifierSchema.optional(),
  external_product_id: sourceIdentifierSchema.optional(),
  title: z.string().trim().min(1).max(180),
  description: z.string().max(50_000).optional().nullable(),
  images: z.array(imageSchema).max(100).optional(),
  variants: z.array(resellerVariantSchema).max(200).optional(),
  stock: z.coerce.number().int().min(0).max(2_000_000_000).optional(),
  supplier_price: moneySchema.optional(),
}).superRefine((product, context) => {
  if (!product.id && !product.external_product_id) {
    context.addIssue({
      code: "custom",
      message: "Each reseller product must include id or external_product_id.",
      path: ["id"],
    });
  }

  const variants = product.variants ?? [];
  if (variants.some((variant) => variant.supplier_price === undefined) &&
      product.supplier_price === undefined) {
    context.addIssue({
      code: "custom",
      message: "Each variant or its product must provide supplier_price.",
      path: ["supplier_price"],
    });
  }
});

export type NormalizedResellerProduct = {
  externalProductId: string;
  title: string;
  description: string | null;
  images: Array<{ url: string; altText: string }>;
  variants: Array<{
    externalVariantId: string;
    externalSku: string | null;
    name: string | null;
    size: string | null;
    color: string | null;
    stock: number;
    supplierPrice: string;
  }>;
};

function extractProductArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (typeof payload !== "object" || payload === null) {
    throw new Error("Reseller API response must contain a product array.");
  }

  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.products)) {
    return record.products;
  }
  if (Array.isArray(record.data)) {
    return record.data;
  }

  if (typeof record.data === "object" && record.data !== null) {
    const data = record.data as Record<string, unknown>;
    if (Array.isArray(data.products)) {
      return data.products;
    }
  }

  throw new Error(
    "Reseller API response must be an array or contain products/data arrays.",
  );
}

export function normalizeResellerPayload(
  payload: unknown,
): NormalizedResellerProduct[] {
  const rawProducts = extractProductArray(payload);
  if (rawProducts.length > 500) {
    throw new Error("Reseller API returned more than 500 products; sync was stopped.");
  }

  const products = rawProducts.map((raw, productIndex) => {
    const parsed = resellerProductSchema.safeParse(raw);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      throw new Error(
        `Invalid reseller product at index ${productIndex}: ${firstIssue?.message ?? "invalid data"}`,
      );
    }

    const product = parsed.data;
    const externalProductId =
      product.external_product_id ?? product.id;
    if (!externalProductId) {
      throw new Error(`Reseller product at index ${productIndex} has no external ID.`);
    }

    const variants = product.variants?.length
      ? product.variants
      : [{
          id: "default",
          sku: undefined,
          name: undefined,
          size: undefined,
          color: undefined,
          stock: product.stock,
          supplier_price: product.supplier_price,
        }];

    return {
      externalProductId,
      title: product.title,
      description: product.description ?? null,
      images: product.images ?? [],
      variants: variants.map((variant, variantIndex) => {
        const externalVariantId =
          variant.external_variant_id ??
          variant.id ??
          variant.sku ??
          `${externalProductId}-variant-${variantIndex + 1}`;
        const supplierPrice =
          variant.supplier_price ?? product.supplier_price;

        if (supplierPrice === undefined) {
          throw new Error(
            `Variant ${externalVariantId} on product ${externalProductId} has no supplier_price.`,
          );
        }

        return {
          externalVariantId,
          externalSku: variant.sku || null,
          name: variant.name || null,
          size: variant.size || null,
          color: variant.color || null,
          stock: variant.stock ?? product.stock ?? 0,
          supplierPrice: supplierPrice.toFixed(2),
        };
      }),
    };
  });

  const productIds = new Set<string>();
  const duplicateId = products.find((product) => {
    if (productIds.has(product.externalProductId)) {
      return true;
    }
    productIds.add(product.externalProductId);
    return false;
  });
  if (duplicateId) {
    throw new Error(
      `Reseller API returned duplicate product id ${duplicateId.externalProductId}.`,
    );
  }

  return products;
}

async function readJsonBody(response: Response): Promise<unknown> {
  const contentLength = Number(response.headers.get("content-length"));
  const maxBytes = 5 * 1024 * 1024;
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error("Reseller API response exceeds the 5 MB limit.");
  }

  if (!response.body) {
    throw new Error("Reseller API returned an empty response.");
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error("Reseller API response exceeds the 5 MB limit.");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(body)) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Reseller API returned invalid JSON.");
    }
    throw error;
  }
}

export type ResellerApiSource = Pick<
  ResellerSource,
  "baseUrl" | "authType" | "encryptedApiKey"
>;

export async function fetchResellerProducts(
  source: ResellerApiSource,
  apiKey: string,
  limit = 500,
): Promise<NormalizedResellerProduct[]> {
  const baseUrl = await assertPublicHttpsUrl(source.baseUrl);
  const url = createProductsUrl(baseUrl, limit);
  const headers = new Headers({ Accept: "application/json" });

  if (source.authType === "BEARER") {
    headers.set("Authorization", `Bearer ${apiKey}`);
  } else {
    headers.set("X-API-Key", apiKey);
  }

  const response = await fetch(url, {
    headers,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Reseller API returned HTTP ${response.status}.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("Reseller API must respond with application/json.");
  }

  return normalizeResellerPayload(await readJsonBody(response));
}
