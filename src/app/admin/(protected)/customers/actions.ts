"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/auth/authorization";
import type { ActionState } from "@/lib/actions/action-state";
import { runCustomerFraudCheck } from "@/lib/fraud/service";

export async function runFraudHistoryCheck(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = z.string().min(1).safeParse(formData.get("customerId"));
  if (!parsed.success) return { error: "Customer was not selected." };
  try {
    await runCustomerFraudCheck(parsed.data, staff.id);
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath(`/admin/customers/${parsed.data}`);
  return { success: "Order-history check saved. It does not contact an external fraud provider." };
}
