"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/auth/authorization";
import type { ActionState } from "@/lib/actions/action-state";
import { slugify } from "@/lib/catalog/slug";
import { getPrisma } from "@/lib/prisma";

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

const createCategorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(5000),
  parentId: z.string().trim(),
});

export async function createCategory(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = createCategorySchema.safeParse({
    name: readFormString(formData, "name"),
    description: readFormString(formData, "description"),
    parentId: readFormString(formData, "parentId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Category details are invalid." };
  }

  const input = parsed.data;
  const slug = slugify(input.name);
  const prisma = getPrisma();
  const [duplicate, parent] = await Promise.all([
    prisma.category.findFirst({
      where: { OR: [{ name: input.name }, { slug }] },
      select: { id: true },
    }),
    input.parentId
      ? prisma.category.findUnique({ where: { id: input.parentId }, select: { id: true } })
      : null,
  ]);
  if (duplicate) {
    return { error: "A category with this name already exists." };
  }
  if (input.parentId && !parent) {
    return { error: "Choose an existing parent category." };
  }

  await prisma.category.create({
    data: {
      name: input.name,
      slug,
      description: input.description || null,
      parentId: parent?.id,
    },
  });

  revalidatePath("/admin/catalog");
  revalidatePath("/admin/inventory/products/new");
  return { success: "Category added." };
}

const updateCategorySchema = createCategorySchema.omit({ parentId: true }).extend({
  categoryId: z.string().min(1),
});

export async function updateCategory(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = updateCategorySchema.safeParse({
    categoryId: readFormString(formData, "categoryId"),
    name: readFormString(formData, "name"),
    description: readFormString(formData, "description"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Category details are invalid." };
  }

  const input = parsed.data;
  const slug = slugify(input.name);
  const prisma = getPrisma();
  const category = await prisma.category.findUnique({
    where: { id: input.categoryId },
    select: { id: true },
  });
  if (!category) {
    return { error: "Category was not found." };
  }

  const duplicate = await prisma.category.findFirst({
    where: {
      id: { not: category.id },
      OR: [{ name: input.name }, { slug }],
    },
    select: { id: true },
  });
  if (duplicate) {
    return { error: "A category with this name already exists." };
  }

  await prisma.category.update({
    where: { id: category.id },
    data: {
      name: input.name,
      slug,
      description: input.description || null,
    },
  });

  revalidatePath("/admin/catalog");
  revalidatePath("/admin/inventory/products");
  return { success: "Category updated." };
}

const createBrandSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(5000),
});

export async function createBrand(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = createBrandSchema.safeParse({
    name: readFormString(formData, "name"),
    description: readFormString(formData, "description"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Brand details are invalid." };
  }

  const input = parsed.data;
  const slug = slugify(input.name);
  const duplicate = await getPrisma().brand.findFirst({
    where: { OR: [{ name: input.name }, { slug }] },
    select: { id: true },
  });
  if (duplicate) {
    return { error: "A brand with this name already exists." };
  }

  await getPrisma().brand.create({
    data: {
      name: input.name,
      slug,
      description: input.description || null,
    },
  });

  revalidatePath("/admin/catalog");
  revalidatePath("/admin/inventory/products/new");
  return { success: "Brand added." };
}

const updateBrandSchema = createBrandSchema.extend({
  brandId: z.string().min(1),
});

export async function updateBrand(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = updateBrandSchema.safeParse({
    brandId: readFormString(formData, "brandId"),
    name: readFormString(formData, "name"),
    description: readFormString(formData, "description"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Brand details are invalid." };
  }

  const input = parsed.data;
  const slug = slugify(input.name);
  const prisma = getPrisma();
  const brand = await prisma.brand.findUnique({
    where: { id: input.brandId },
    select: { id: true },
  });
  if (!brand) {
    return { error: "Brand was not found." };
  }

  const duplicate = await prisma.brand.findFirst({
    where: {
      id: { not: brand.id },
      OR: [{ name: input.name }, { slug }],
    },
    select: { id: true },
  });
  if (duplicate) {
    return { error: "A brand with this name already exists." };
  }

  await prisma.brand.update({
    where: { id: brand.id },
    data: {
      name: input.name,
      slug,
      description: input.description || null,
    },
  });

  revalidatePath("/admin/catalog");
  revalidatePath("/admin/inventory/products");
  return { success: "Brand updated." };
}
