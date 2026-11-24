"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/auth/authorization";
import type { ActionState } from "@/lib/actions/action-state";
import { writeActivityLog } from "@/lib/accounting/service";
import { getPrisma } from "@/lib/prisma";
import { updateOrderStatus } from "@/lib/orders/service";

function value(formData: FormData, name: string): string {
  const field = formData.get(name);
  return typeof field === "string" ? field : "";
}

const statusSchema = z.object({
  orderId: z.string().min(1),
  nextStatus: z.enum([
    "PENDING",
    "AWAITING_PAYMENT",
    "CONFIRMED",
    "PROCESSING",
    "PACKED",
    "SHIPPED",
    "DELIVERED",
    "RETURNED",
    "CANCELLED",
  ]),
  note: z.string().trim().max(2000),
});

export async function setOrderStatus(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = statusSchema.safeParse({
    orderId: value(formData, "orderId"),
    nextStatus: value(formData, "nextStatus"),
    note: value(formData, "note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Order status is invalid." };
  }

  try {
    await updateOrderStatus({
      orderId: parsed.data.orderId,
      nextStatus: parsed.data.nextStatus,
      actorId: staff.id,
      note: parsed.data.note,
    });
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin/orders/scan");
  revalidatePath(`/admin/orders/${parsed.data.orderId}/print`);
  return { success: "Order status updated." };
}

const noteSchema = z.object({
  orderId: z.string().min(1),
  body: z.string().trim().min(1).max(2000),
});

export async function addOrderNote(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = noteSchema.safeParse({
    orderId: value(formData, "orderId"),
    body: value(formData, "body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Order note is invalid." };
  }

  const order = await getPrisma().order.findUnique({
    where: { id: parsed.data.orderId },
    select: { id: true },
  });
  if (!order) return { error: "Order was not found." };

  await getPrisma().$transaction(async (tx) => {
    const note = await tx.orderNote.create({
      data: {
        orderId: order.id,
        authorId: staff.id,
        body: parsed.data.body,
      },
    });
    await writeActivityLog(tx, {
      actorId: staff.id,
      action: "ORDER_NOTE_ADDED",
      entityType: "Order",
      entityId: order.id,
      summary: "Added a quick note to an order.",
    });
    return note;
  });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${order.id}/print`);
  return { success: "Quick note added." };
}

