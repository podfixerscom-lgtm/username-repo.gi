"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/auth/authorization";
import { slugify } from "@/lib/catalog/slug";
import { getPrisma } from "@/lib/prisma";
import type { ActionState } from "@/lib/actions/action-state";

const moneyField = z.string()
  .trim()
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/, "Enter a BDT amount with up to 2 decimal places.")
  .transform(Number)
  .refine((value) => Number.isFinite(value) && value <= 9_999_999_999.99);

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function isSecureImageUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const createProductSchema = z.object({
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(50_000),
  type: z.enum(["PHYSICAL", "DIGITAL"]),
  categoryId: z.string().trim(),
  brandId: z.string().trim(),
  shippingClassId: z.string().trim(),
  weightGrams: z.string().trim().regex(/^\d{1,9}$/).transform(Number).pipe(z.number().max(100_000_000)),
  allowPreorder: z.boolean(),
  sizeGuide: z.string().trim().max(5000),
  price: moneyField,
  sku: z.string().trim().min(2).max(120),
});

export async function createProduct(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = createProductSchema.safeParse({
    name: readFormString(formData, "name"),
    description: readFormString(formData, "description"),
    type: readFormString(formData, "type"),
    categoryId: readFormString(formData, "categoryId"),
    brandId: readFormString(formData, "brandId"),
    shippingClassId: readFormString(formData, "shippingClassId"),
    weightGrams: readFormString(formData, "weightGrams"),
    allowPreorder: formData.get("allowPreorder") === "on",
    sizeGuide: readFormString(formData, "sizeGuide"),
    price: readFormString(formData, "price"),
    sku: readFormString(formData, "sku"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Product details are invalid." };
  }

  const input = parsed.data;
  const slug = slugify(input.name);
  const prisma = getPrisma();
  const [existingSlug, existingSku, category, brand, shippingClass] = await Promise.all([
    prisma.product.findUnique({ where: { slug }, select: { id: true } }),
    prisma.productVariant.findUnique({ where: { sku: input.sku }, select: { id: true } }),
    input.categoryId
      ? prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } })
      : null,
    input.brandId
      ? prisma.brand.findUnique({ where: { id: input.brandId }, select: { id: true } })
      : null,
    input.shippingClassId
      ? prisma.shippingClass.findFirst({
        where: { id: input.shippingClassId, isActive: true },
        select: { id: true },
      })
      : null,
  ]);
  if (existingSlug) {
    return { error: "A product with this generated URL already exists." };
  }
  if (existingSku) {
    return { error: "This SKU is already in use." };
  }
  if (input.categoryId && !category) {
    return { error: "Choose an existing category." };
  }
  if (input.brandId && !brand) {
    return { error: "Choose an existing brand." };
  }
  if (input.shippingClassId && !shippingClass) {
    return { error: "Choose an active shipping class." };
  }

  const product = await prisma.product.create({
    data: {
      name: input.name,
      slug,
      description: input.description || null,
      type: input.type,
      price: input.price.toFixed(2),
      currencyCode: "BDT",
      categoryId: category?.id,
      brandId: brand?.id,
      shippingClassId: shippingClass?.id,
      weightGrams: input.weightGrams,
      allowPreorder: input.allowPreorder,
      sizeGuide: input.sizeGuide || null,
      variants: {
        create: {
          name: "Default",
          sku: input.sku,
          price: input.price.toFixed(2),
        },
      },
    },
    select: { id: true },
  });

  revalidatePath("/admin/inventory/products");
  redirect(`/admin/inventory/products/${product.id}`);
}

const updateProductSchema = z.object({
  productId: z.string().min(1),
  name: z.string().trim().min(2).max(180),
  description: z.string().trim().max(50_000),
  categoryId: z.string().trim(),
  brandId: z.string().trim(),
  shippingClassId: z.string().trim(),
  weightGrams: z.string().trim().regex(/^\d{1,9}$/).transform(Number).pipe(z.number().max(100_000_000)),
  allowPreorder: z.boolean(),
  sizeGuide: z.string().trim().max(5000),
  price: moneyField,
});

export async function updateProduct(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = updateProductSchema.safeParse({
    productId: readFormString(formData, "productId"),
    name: readFormString(formData, "name"),
    description: readFormString(formData, "description"),
    categoryId: readFormString(formData, "categoryId"),
    brandId: readFormString(formData, "brandId"),
    shippingClassId: readFormString(formData, "shippingClassId"),
    weightGrams: readFormString(formData, "weightGrams"),
    allowPreorder: formData.get("allowPreorder") === "on",
    sizeGuide: readFormString(formData, "sizeGuide"),
    price: readFormString(formData, "price"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Product details are invalid." };
  }

  const input = parsed.data;
  const prisma = getPrisma();
  const [product, category, brand, shippingClass] = await Promise.all([
    prisma.product.findUnique({
      where: { id: input.productId },
      select: { id: true, isResellerProduct: true },
    }),
    input.categoryId
      ? prisma.category.findUnique({ where: { id: input.categoryId }, select: { id: true } })
      : null,
    input.brandId
      ? prisma.brand.findUnique({ where: { id: input.brandId }, select: { id: true } })
      : null,
    input.shippingClassId
      ? prisma.shippingClass.findFirst({
        where: { id: input.shippingClassId, isActive: true },
        select: { id: true },
      })
      : null,
  ]);
  if (!product) {
    return { error: "Product was not found." };
  }
  if (input.categoryId && !category) {
    return { error: "Choose an existing category." };
  }
  if (input.brandId && !brand) {
    return { error: "Choose an existing brand." };
  }
  if (input.shippingClassId && !shippingClass) {
    return { error: "Choose an active shipping class." };
  }

  await prisma.product.update({
    where: { id: product.id },
    data: {
      name: input.name,
      description: input.description || null,
      price: input.price.toFixed(2),
      categoryId: category?.id ?? null,
      brandId: brand?.id ?? null,
      shippingClassId: shippingClass?.id ?? null,
      weightGrams: input.weightGrams,
      allowPreorder: input.allowPreorder,
      sizeGuide: input.sizeGuide || null,
    },
  });

  revalidatePath("/admin/inventory/products");
  revalidatePath(`/admin/inventory/products/${product.id}`);
  return {
    success: product.isResellerProduct
      ? "Product saved. A future reseller sync can replace supplier-managed fields."
      : "Product details saved.",
  };
}

const variantSchema = z.object({
  productId: z.string().min(1),
  name: z.string().trim().max(120),
  sku: z.string().trim().min(2).max(120),
  size: z.string().trim().max(80),
  color: z.string().trim().max(80),
  price: moneyField,
});

export async function addProductVariant(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = variantSchema.safeParse({
    productId: readFormString(formData, "productId"),
    name: readFormString(formData, "name"),
    sku: readFormString(formData, "sku"),
    size: readFormString(formData, "size"),
    color: readFormString(formData, "color"),
    price: readFormString(formData, "price"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Variant details are invalid." };
  }

  const input = parsed.data;
  const prisma = getPrisma();
  const [product, existingSku] = await Promise.all([
    prisma.product.findUnique({ where: { id: input.productId }, select: { id: true } }),
    prisma.productVariant.findUnique({ where: { sku: input.sku }, select: { id: true } }),
  ]);
  if (!product) {
    return { error: "Product was not found." };
  }
  if (existingSku) {
    return { error: "This SKU is already in use." };
  }

  await prisma.productVariant.create({
    data: {
      productId: product.id,
      name: input.name || null,
      sku: input.sku,
      size: input.size || null,
      color: input.color || null,
      price: input.price.toFixed(2),
    },
  });

  revalidatePath(`/admin/inventory/products/${product.id}`);
  return { success: "Variant added. Add stock from Stock Tools." };
}

const updateVariantSchema = variantSchema.extend({
  variantId: z.string().min(1),
  isActive: z.boolean(),
});

export async function updateProductVariant(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = updateVariantSchema.safeParse({
    productId: readFormString(formData, "productId"),
    variantId: readFormString(formData, "variantId"),
    name: readFormString(formData, "name"),
    sku: readFormString(formData, "sku"),
    size: readFormString(formData, "size"),
    color: readFormString(formData, "color"),
    price: readFormString(formData, "price"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Variant details are invalid." };
  }

  const { productId, variantId, ...input } = parsed.data;
  const prisma = getPrisma();
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, productId },
    select: { id: true },
  });
  if (!variant) {
    return { error: "Product variant was not found." };
  }

  const duplicateSku = await prisma.productVariant.findFirst({
    where: { sku: input.sku, id: { not: variant.id } },
    select: { id: true },
  });
  if (duplicateSku) {
    return { error: "This SKU is already in use." };
  }

  await prisma.productVariant.update({
    where: { id: variant.id },
    data: {
      name: input.name || null,
      sku: input.sku,
      size: input.size || null,
      color: input.color || null,
      price: input.price.toFixed(2),
      isActive: input.isActive,
    },
  });

  revalidatePath(`/admin/inventory/products/${productId}`);
  return { success: "Variant details saved." };
}

const imageSchema = z.object({
  productId: z.string().min(1),
  url: z.string().url().refine(isSecureImageUrl, "Image URL must use HTTPS."),
  altText: z.string().trim().min(2).max(250),
});

export async function addProductImage(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = imageSchema.safeParse({
    productId: readFormString(formData, "productId"),
    url: readFormString(formData, "url"),
    altText: readFormString(formData, "altText"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Image details are invalid." };
  }

  const product = await getPrisma().product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true },
  });
  if (!product) {
    return { error: "Product was not found." };
  }

  const sortOrder = await getPrisma().productImage.count({
    where: { productId: product.id },
  });
  await getPrisma().productImage.create({
    data: {
      productId: product.id,
      url: parsed.data.url,
      altText: parsed.data.altText,
      sortOrder,
    },
  });

  revalidatePath(`/admin/inventory/products/${product.id}`);
  return { success: "Image added." };
}

export async function removeProductImage(formData: FormData): Promise<void> {
  await requireStaff(["ADMIN", "MANAGER"]);
  const imageId = readFormString(formData, "imageId");
  const productId = readFormString(formData, "productId");
  if (!imageId || !productId) {
    throw new Error("Image and product identifiers are required.");
  }

  await getPrisma().productImage.deleteMany({
    where: { id: imageId, productId },
  });
  revalidatePath(`/admin/inventory/products/${productId}`);
}
