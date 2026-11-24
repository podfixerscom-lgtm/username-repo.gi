"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/auth/authorization";
import type { ActionState } from "@/lib/actions/action-state";
import { getPrisma } from "@/lib/prisma";
import { adjustStock, transferStock } from "@/lib/inventory/service";

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

const quantityField = z.string()
  .trim()
  .regex(/^[1-9]\d{0,8}$/, "Enter a whole quantity greater than zero.")
  .transform(Number);

const moneyField = z.string()
  .trim()
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/, "Enter a BDT amount with up to 2 decimal places.")
  .transform(Number)
  .refine((value) => Number.isFinite(value) && value <= 9_999_999_999.99);

const adjustmentSchema = z.object({
  variantId: z.string().min(1),
  warehouseId: z.string().min(1),
  direction: z.enum(["IN", "OUT"]),
  quantity: quantityField,
  type: z.enum(["RECEIVE", "DAMAGE", "LOSS", "RETURN", "CORRECTION"]),
  unitCost: z.string().trim(),
  note: z.string().trim().max(2000),
});

export async function recordStockAdjustment(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireStaff();
  const parsed = adjustmentSchema.safeParse({
    variantId: readFormString(formData, "variantId"),
    warehouseId: readFormString(formData, "warehouseId"),
    direction: readFormString(formData, "direction"),
    quantity: readFormString(formData, "quantity"),
    type: readFormString(formData, "type"),
    unitCost: readFormString(formData, "unitCost"),
    note: readFormString(formData, "note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Stock adjustment is invalid." };
  }

  const input = parsed.data;
  if ((input.type === "RECEIVE" || input.type === "RETURN") && input.direction !== "IN") {
    return { error: "Receive and return adjustments must increase stock." };
  }
  if ((input.type === "DAMAGE" || input.type === "LOSS") && input.direction !== "OUT") {
    return { error: "Damage and loss adjustments must decrease stock." };
  }
  if (input.direction === "IN" && !input.unitCost) {
    return { error: "Unit cost is required when receiving stock." };
  }

  let unitCost: number | undefined;
  if (input.direction === "IN") {
    const parsedCost = moneyField.safeParse(input.unitCost);
    if (!parsedCost.success) {
      return { error: parsedCost.error.issues[0]?.message ?? "Unit cost is invalid." };
    }
    unitCost = parsedCost.data;
  }

  try {
    await adjustStock({
      variantId: input.variantId,
      warehouseId: input.warehouseId,
      createdById: user.id,
      quantityChange: input.direction === "IN" ? input.quantity : -input.quantity,
      unitCost: unitCost?.toFixed(2),
      type: input.type,
      note: input.note || undefined,
    });
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath("/admin/stock");
  revalidatePath("/admin/inventory/products");
  return { success: "Stock adjustment recorded in the audit log." };
}

const transferSchema = z.object({
  variantId: z.string().min(1),
  fromWarehouseId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  quantity: quantityField,
  note: z.string().trim().max(2000),
});

export async function recordStockTransfer(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireStaff();
  const parsed = transferSchema.safeParse({
    variantId: readFormString(formData, "variantId"),
    fromWarehouseId: readFormString(formData, "fromWarehouseId"),
    toWarehouseId: readFormString(formData, "toWarehouseId"),
    quantity: readFormString(formData, "quantity"),
    note: readFormString(formData, "note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Stock transfer is invalid." };
  }

  try {
    await transferStock({
      ...parsed.data,
      createdById: user.id,
    });
  } catch (error) {
    if (error instanceof Error) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath("/admin/stock");
  revalidatePath("/admin/inventory/products");
  return { success: "Stock transfer recorded with its FIFO batch history." };
}

const warehouseSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{2,40}$/),
});

export async function createWarehouse(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = warehouseSchema.safeParse({
    name: readFormString(formData, "name"),
    code: readFormString(formData, "code"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Warehouse details are invalid." };
  }

  const duplicate = await getPrisma().warehouse.findFirst({
    where: {
      OR: [{ name: parsed.data.name }, { code: parsed.data.code }],
    },
    select: { id: true },
  });
  if (duplicate) {
    return { error: "A warehouse with this name or code already exists." };
  }

  await getPrisma().warehouse.create({ data: parsed.data });
  revalidatePath("/admin/stock");
  return { success: "Warehouse added." };
}
