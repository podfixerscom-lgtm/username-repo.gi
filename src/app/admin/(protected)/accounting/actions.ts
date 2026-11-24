"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { requireStaff } from "@/auth/authorization";
import type { ActionState } from "@/lib/actions/action-state";
import {
  createAccountingCategory,
  createFinancialAccount,
  createPayrollRecord,
  payPayrollRecord,
  recordAccountingTransaction,
  reconcileCourierSettlement,
} from "@/lib/accounting/service";
import { parseDhakaDate } from "@/lib/reports/date-range";
import { getPrisma } from "@/lib/prisma";

function value(formData: FormData, name: string): string {
  const field = formData.get(name);
  return typeof field === "string" ? field : "";
}

const money = z.string().trim().regex(/^\d{1,10}(?:\.\d{1,2})?$/);
const accountSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(["CASH", "BANK", "MOBILE_WALLET", "OTHER"]),
  provider: z.string().trim().max(80),
  accountReference: z.string().trim().max(80),
  openingBalance: money,
});

export async function addFinancialAccount(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = accountSchema.safeParse({
    name: value(formData, "name"),
    type: value(formData, "type"),
    provider: value(formData, "provider"),
    accountReference: value(formData, "accountReference"),
    openingBalance: value(formData, "openingBalance"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Account details are invalid." };

  try {
    await createFinancialAccount({ ...parsed.data, actorId: staff.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "An account with this name already exists." };
    }
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/accounting");
  revalidatePath("/admin");
  return { success: "Financial account created." };
}

const categorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  type: z.enum(["INCOME", "EXPENSE"]),
});

export async function addAccountingCategory(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = categorySchema.safeParse({
    name: value(formData, "name"),
    type: value(formData, "type"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Category details are invalid." };

  try {
    await createAccountingCategory({ ...parsed.data, actorId: staff.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "This category already exists for that type." };
    }
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/accounting");
  revalidatePath("/admin/accounting/payroll");
  revalidatePath("/admin/accounting/courier");
  return { success: "Accounting category created." };
}

const transactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  amount: money,
  description: z.string().trim().min(2).max(2000),
  occurredAt: z.string().trim().min(1),
  accountId: z.string().min(1),
  destinationAccountId: z.string(),
  categoryId: z.string(),
});

export async function addAccountingTransaction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = transactionSchema.safeParse({
    type: value(formData, "type"),
    amount: value(formData, "amount"),
    description: value(formData, "description"),
    occurredAt: value(formData, "occurredAt"),
    accountId: value(formData, "accountId"),
    destinationAccountId: value(formData, "destinationAccountId"),
    categoryId: value(formData, "categoryId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Transaction details are invalid." };
  const occurredAt = parseDhakaDate(parsed.data.occurredAt);
  if (!occurredAt) return { error: "Choose a valid transaction date." };

  try {
    await recordAccountingTransaction({
      actorId: staff.id,
      ...parsed.data,
      occurredAt,
      destinationAccountId: parsed.data.destinationAccountId || undefined,
      categoryId: parsed.data.categoryId || undefined,
    });
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/accounting");
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
  revalidatePath("/admin/activity");
  return { success: "Ledger transaction recorded." };
}

const payrollSchema = z.object({
  employeeId: z.string().min(1),
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  baseSalary: money,
  allowances: money,
  deductions: money,
});

export async function addPayrollRecord(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = payrollSchema.safeParse({
    employeeId: value(formData, "employeeId"),
    period: value(formData, "period"),
    baseSalary: value(formData, "baseSalary"),
    allowances: value(formData, "allowances"),
    deductions: value(formData, "deductions"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Payroll details are invalid." };

  try {
    await createPayrollRecord({ ...parsed.data, actorId: staff.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "A payroll record already exists for this staff member and period." };
    }
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/accounting/payroll");
  revalidatePath("/admin/activity");
  return { success: "Payroll record prepared. Record the payment when it is paid." };
}

const payPayrollSchema = z.object({
  payrollId: z.string().min(1),
  accountId: z.string().min(1),
});

export async function payPayroll(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = payPayrollSchema.safeParse({
    payrollId: value(formData, "payrollId"),
    accountId: value(formData, "accountId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Payroll payment details are invalid." };

  try {
    await payPayrollRecord({ ...parsed.data, actorId: staff.id });
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/accounting");
  revalidatePath("/admin/accounting/payroll");
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
  revalidatePath("/admin/activity");
  return { success: "Payroll payment posted to the ledger." };
}

const courierSettlementSchema = z.object({
  bookingId: z.string().min(1),
  accountId: z.string().min(1),
  receivedAmount: money,
  courierFee: money,
  paymentReference: z.string().trim().max(160),
});

export async function reconcileCourierCod(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = courierSettlementSchema.safeParse({
    bookingId: value(formData, "bookingId"),
    accountId: value(formData, "accountId"),
    receivedAmount: value(formData, "receivedAmount"),
    courierFee: value(formData, "courierFee"),
    paymentReference: value(formData, "paymentReference"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Courier remittance details are invalid." };

  try {
    await reconcileCourierSettlement({ ...parsed.data, actorId: staff.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "This courier booking was reconciled already. Refresh the page." };
    }
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/accounting");
  revalidatePath("/admin/accounting/courier");
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
  revalidatePath("/admin/activity");
  return { success: "Courier COD remittance reconciled and posted to the ledger." };
}

export async function getActiveAccountingOptions() {
  await requireStaff(["ADMIN", "MANAGER"]);
  const prisma = getPrisma();
  const [accounts, incomeCategories, expenseCategories, employees] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true },
    }),
    prisma.accountingCategory.findMany({
      where: { isActive: true, type: "INCOME" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.accountingCategory.findMany({
      where: { isActive: true, type: "EXPENSE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
  ]);
  return { accounts, incomeCategories, expenseCategories, employees };
}
