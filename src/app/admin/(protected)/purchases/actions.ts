"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/auth/authorization";
import type { ActionState } from "@/lib/actions/action-state";
import { writeActivityLog } from "@/lib/accounting/service";
import { getPrisma } from "@/lib/prisma";
import { receivePurchaseOrderItem } from "@/lib/purchases/service";

function value(formData: FormData, name: string): string {
  const field = formData.get(name);
  return typeof field === "string" ? field : "";
}

const supplierSchema = z.object({
  name: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(40),
  email: z.union([z.literal(""), z.email()]),
  address: z.string().trim().max(2000),
});

export async function createSupplier(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = supplierSchema.safeParse({
    name: value(formData, "name"),
    phone: value(formData, "phone"),
    email: value(formData, "email").trim(),
    address: value(formData, "address"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Supplier details are invalid." };

  const duplicate = await getPrisma().supplier.findUnique({
    where: { name: parsed.data.name },
    select: { id: true },
  });
  if (duplicate) return { error: "A supplier with this name already exists." };

  await getPrisma().$transaction(async (tx) => {
    const supplier = await tx.supplier.create({
      data: {
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
      },
    });
    await writeActivityLog(tx, {
      actorId: staff.id,
      action: "SUPPLIER_CREATED",
      entityType: "Supplier",
      entityId: supplier.id,
      summary: `Created supplier "${supplier.name}".`,
    });
    return supplier;
  });
  revalidatePath("/admin/purchases");
  return { success: "Supplier added." };
}

const moneyField = z.string()
  .trim()
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/)
  .transform(Number)
  .refine((amount) => Number.isFinite(amount) && amount <= 9_999_999_999.99);

const purchaseSchema = z.object({
  supplierId: z.string().min(1),
  variantId: z.string().min(1),
  quantity: z.string().regex(/^[1-9]\d{0,8}$/).transform(Number),
  unitCost: moneyField,
  note: z.string().trim().max(2000),
});

export async function createPurchaseOrder(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = purchaseSchema.safeParse({
    supplierId: value(formData, "supplierId"),
    variantId: value(formData, "variantId"),
    quantity: value(formData, "quantity"),
    unitCost: value(formData, "unitCost"),
    note: value(formData, "note"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Purchase order is invalid." };

  const [supplier, variant] = await Promise.all([
    getPrisma().supplier.findFirst({
      where: { id: parsed.data.supplierId, isActive: true },
      select: { id: true },
    }),
    getPrisma().productVariant.findFirst({
      where: {
        id: parsed.data.variantId,
        isActive: true,
        product: { isActive: true, type: "PHYSICAL" },
      },
      select: { id: true },
    }),
  ]);
  if (!supplier) return { error: "Choose an active supplier." };
  if (!variant) return { error: "Choose an active physical product variant." };

  await getPrisma().$transaction(async (tx) => {
    const purchaseOrder = await tx.purchaseOrder.create({
      data: {
        supplierId: supplier.id,
        createdById: staff.id,
        note: parsed.data.note || null,
        items: {
          create: {
            variantId: variant.id,
            quantityOrdered: parsed.data.quantity,
            unitCost: parsed.data.unitCost.toFixed(2),
          },
        },
      },
    });
    await writeActivityLog(tx, {
      actorId: staff.id,
      action: "PURCHASE_ORDER_CREATED",
      entityType: "PurchaseOrder",
      entityId: purchaseOrder.id,
      summary: `Created a purchase order with ${parsed.data.quantity} units.`,
      details: { supplierId: supplier.id, variantId: variant.id, quantity: parsed.data.quantity },
    });
    return purchaseOrder;
  });
  revalidatePath("/admin/purchases");
  return { success: "Purchase order created." };
}

const receiveSchema = z.object({
  purchaseOrderItemId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.string().regex(/^[1-9]\d{0,8}$/).transform(Number),
});

export async function receivePurchaseOrder(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = receiveSchema.safeParse({
    purchaseOrderItemId: value(formData, "purchaseOrderItemId"),
    warehouseId: value(formData, "warehouseId"),
    quantity: value(formData, "quantity"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Received quantity is invalid." };

  try {
    await receivePurchaseOrderItem({ ...parsed.data, createdById: staff.id });
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/purchases");
  revalidatePath("/admin/stock");
  revalidatePath("/admin/inventory/products");
  revalidatePath("/admin/orders");
  return { success: "Stock received into FIFO inventory." };
}
