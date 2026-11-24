import { AccountingCategoryType, Prisma } from "@/generated/prisma/client";
import type {
  AccountingTransactionType,
  Prisma as PrismaTypes,
} from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

type Transaction = PrismaTypes.TransactionClient;

async function getAccountBalance(tx: Transaction, accountId: string) {
  const [account, movements, incomingTransfers] = await Promise.all([
    tx.financialAccount.findUnique({
      where: { id: accountId },
      select: { openingBalance: true },
    }),
    tx.accountingTransaction.groupBy({
      by: ["type"],
      where: { accountId },
      _sum: { amount: true },
    }),
    tx.accountingTransaction.aggregate({
      where: { destinationAccountId: accountId, type: "TRANSFER" },
      _sum: { amount: true },
    }),
  ]);
  if (!account) throw new Error("Financial account was not found.");
  let balance = account.openingBalance.plus(incomingTransfers._sum.amount ?? 0);
  for (const movement of movements) {
    const amount = movement._sum.amount ?? new Prisma.Decimal(0);
    if (movement.type === "INCOME") balance = balance.plus(amount);
    else balance = balance.minus(amount);
  }
  return balance;
}

export async function writeActivityLog(
  tx: Transaction,
  input: {
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
    details?: Prisma.InputJsonValue;
  },
) {
  return tx.activityLog.create({
    data: {
      ...input,
      details: input.details,
    },
  });
}

export async function createFinancialAccount(input: {
  actorId: string;
  name: string;
  type: "CASH" | "BANK" | "MOBILE_WALLET" | "OTHER";
  provider: string;
  accountReference: string;
  openingBalance: string;
}) {
  const openingBalance = new Prisma.Decimal(input.openingBalance);
  if (openingBalance.isNegative()) throw new Error("Opening balance cannot be negative.");

  return getPrisma().$transaction(async (tx) => {
    const account = await tx.financialAccount.create({
      data: {
        name: input.name,
        type: input.type,
        provider: input.provider || null,
        accountReference: input.accountReference || null,
        openingBalance,
      },
    });
    await writeActivityLog(tx, {
      actorId: input.actorId,
      action: "ACCOUNT_CREATED",
      entityType: "FinancialAccount",
      entityId: account.id,
      summary: `Created ${account.type.toLowerCase().replace("_", " ")} account "${account.name}".`,
    });
    return account;
  });
}

export async function createAccountingCategory(input: {
  actorId: string;
  name: string;
  type: AccountingCategoryType;
}) {
  return getPrisma().$transaction(async (tx) => {
    const category = await tx.accountingCategory.create({
      data: { name: input.name, type: input.type },
    });
    await writeActivityLog(tx, {
      actorId: input.actorId,
      action: "ACCOUNTING_CATEGORY_CREATED",
      entityType: "AccountingCategory",
      entityId: category.id,
      summary: `Created ${category.type.toLowerCase()} category "${category.name}".`,
    });
    return category;
  });
}

export async function recordAccountingTransaction(input: {
  actorId: string;
  type: AccountingTransactionType;
  amount: string;
  description: string;
  occurredAt: Date;
  accountId: string;
  destinationAccountId?: string;
  categoryId?: string;
}) {
  const amount = new Prisma.Decimal(input.amount);
  if (!amount.isFinite() || amount.lte(0)) throw new Error("Amount must be greater than zero.");
  if (input.type === "TRANSFER" && input.accountId === input.destinationAccountId) {
    throw new Error("Choose two different accounts for a transfer.");
  }

  return getPrisma().$transaction(async (tx) => {
    const account = await tx.financialAccount.findFirst({
      where: { id: input.accountId, isActive: true },
      select: { id: true },
    });
    if (!account) throw new Error("Select an active account.");

    let destinationAccountId: string | null = null;
    let categoryId: string | null = null;
    if (input.type === "TRANSFER") {
      const destination = await tx.financialAccount.findFirst({
        where: { id: input.destinationAccountId, isActive: true },
        select: { id: true },
      });
      if (!destination) throw new Error("Select an active destination account.");
      const balance = await getAccountBalance(tx, account.id);
      if (balance.lt(amount)) throw new Error("The source account does not have enough recorded balance.");
      destinationAccountId = destination.id;
    } else {
      const categoryType = input.type === "INCOME"
        ? AccountingCategoryType.INCOME
        : AccountingCategoryType.EXPENSE;
      const category = await tx.accountingCategory.findFirst({
        where: { id: input.categoryId, type: categoryType, isActive: true },
        select: { id: true },
      });
      if (!category) throw new Error(`Select an active ${categoryType.toLowerCase()} category.`);
      categoryId = category.id;
      if (input.type === "EXPENSE") {
        const balance = await getAccountBalance(tx, account.id);
        if (balance.lt(amount)) throw new Error("The selected account does not have enough recorded balance.");
      }
    }

    const transaction = await tx.accountingTransaction.create({
      data: {
        type: input.type,
        amount,
        description: input.description,
        occurredAt: input.occurredAt,
        accountId: account.id,
        destinationAccountId,
        categoryId,
        createdById: input.actorId,
      },
    });
    await writeActivityLog(tx, {
      actorId: input.actorId,
      action: `ACCOUNTING_${input.type}`,
      entityType: "AccountingTransaction",
      entityId: transaction.id,
      summary: `Recorded ${input.type.toLowerCase()} of BDT ${amount.toFixed(2)}.`,
      details: { amount: amount.toFixed(2), type: input.type },
    });
    return transaction;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function createPayrollRecord(input: {
  actorId: string;
  employeeId: string;
  period: string;
  baseSalary: string;
  allowances: string;
  deductions: string;
}) {
  const baseSalary = new Prisma.Decimal(input.baseSalary);
  const allowances = new Prisma.Decimal(input.allowances);
  const deductions = new Prisma.Decimal(input.deductions);
  if ([baseSalary, allowances, deductions].some((amount) => !amount.isFinite() || amount.isNegative())) {
    throw new Error("Salary, allowances, and deductions must be non-negative amounts.");
  }
  const netPay = baseSalary.plus(allowances).minus(deductions);
  if (netPay.lte(0)) throw new Error("Net salary must be greater than zero.");

  return getPrisma().$transaction(async (tx) => {
    const employee = await tx.user.findFirst({
      where: { id: input.employeeId, isActive: true },
      select: { id: true, name: true, email: true },
    });
    if (!employee) throw new Error("Select an active staff member.");

    const payroll = await tx.payrollRecord.create({
      data: {
        employeeId: employee.id,
        createdById: input.actorId,
        period: input.period,
        baseSalary,
        allowances,
        deductions,
        netPay,
      },
    });
    await writeActivityLog(tx, {
      actorId: input.actorId,
      action: "PAYROLL_CREATED",
      entityType: "PayrollRecord",
      entityId: payroll.id,
      summary: `Prepared payroll for ${employee.name} (${payroll.period}).`,
      details: { employeeId: employee.id, period: payroll.period, netPay: netPay.toFixed(2) },
    });
    return payroll;
  });
}

export async function payPayrollRecord(input: {
  actorId: string;
  payrollId: string;
  accountId: string;
}) {
  return getPrisma().$transaction(async (tx) => {
    const payroll = await tx.payrollRecord.findUnique({
      where: { id: input.payrollId },
      include: { employee: { select: { name: true } } },
    });
    if (!payroll || payroll.status !== "DRAFT") {
      throw new Error("Only an unpaid payroll record can be paid.");
    }
    const account = await tx.financialAccount.findFirst({
      where: { id: input.accountId, isActive: true },
      select: { id: true },
    });
    if (!account) throw new Error("Select an active payment account.");
    const balance = await getAccountBalance(tx, account.id);
    if (balance.lt(payroll.netPay)) throw new Error("The selected account does not have enough recorded balance to pay payroll.");
    const category = await tx.accountingCategory.findUnique({
      where: { name_type: { name: "Payroll", type: AccountingCategoryType.EXPENSE } },
      select: { id: true, isActive: true },
    });
    if (!category?.isActive) throw new Error("The Payroll expense category is unavailable.");

    const transaction = await tx.accountingTransaction.create({
      data: {
        type: "EXPENSE",
        amount: payroll.netPay,
        description: `Payroll ${payroll.period} — ${payroll.employee.name}`,
        accountId: account.id,
        categoryId: category.id,
        createdById: input.actorId,
      },
    });
    const updated = await tx.payrollRecord.updateMany({
      where: { id: payroll.id, status: "DRAFT", transactionId: null },
      data: {
        status: "PAID",
        paidAt: new Date(),
        transactionId: transaction.id,
      },
    });
    if (updated.count !== 1) throw new Error("Payroll changed while paying; refresh and retry.");

    await writeActivityLog(tx, {
      actorId: input.actorId,
      action: "PAYROLL_PAID",
      entityType: "PayrollRecord",
      entityId: payroll.id,
      summary: `Paid BDT ${payroll.netPay.toFixed(2)} payroll for ${payroll.employee.name}.`,
      details: { period: payroll.period, amount: payroll.netPay.toFixed(2), accountId: account.id },
    });
    return transaction;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function reconcileCourierSettlement(input: {
  actorId: string;
  bookingId: string;
  accountId: string;
  receivedAmount: string;
  courierFee: string;
  paymentReference: string;
}) {
  const receivedAmount = new Prisma.Decimal(input.receivedAmount);
  const courierFee = new Prisma.Decimal(input.courierFee);
  if (
    !receivedAmount.isFinite() ||
    !courierFee.isFinite() ||
    receivedAmount.lte(0) ||
    courierFee.isNegative() ||
    courierFee.gt(receivedAmount)
  ) {
    throw new Error("Enter a positive gross COD remittance and a valid courier fee.");
  }

  return getPrisma().$transaction(async (tx) => {
    const booking = await tx.courierBooking.findUnique({
      where: { id: input.bookingId },
      include: {
        order: { select: { orderNumber: true, total: true, paymentMethod: true, status: true } },
        settlement: { select: { id: true } },
      },
    });
    if (
      !booking ||
      booking.status !== "DELIVERED" ||
      booking.order.status !== "DELIVERED" ||
      booking.order.paymentMethod !== "COD"
    ) {
      throw new Error("Only delivered COD orders can be reconciled.");
    }
    if (booking.settlement) throw new Error("This courier booking has already been reconciled.");

    const account = await tx.financialAccount.findFirst({
      where: { id: input.accountId, isActive: true },
      select: { id: true },
    });
    if (!account) throw new Error("Select an active receiving account.");
    const [incomeCategory, expenseCategory] = await Promise.all([
      tx.accountingCategory.findUnique({
        where: { name_type: { name: "Courier COD remittance", type: AccountingCategoryType.INCOME } },
        select: { id: true, isActive: true },
      }),
      tx.accountingCategory.findUnique({
        where: { name_type: { name: "Courier fees", type: AccountingCategoryType.EXPENSE } },
        select: { id: true, isActive: true },
      }),
    ]);
    if (!incomeCategory?.isActive || !expenseCategory?.isActive) {
      throw new Error("Courier accounting categories are unavailable; seed the default categories first.");
    }

    const settlement = await tx.courierSettlement.create({
      data: {
        bookingId: booking.id,
        accountId: account.id,
        createdById: input.actorId,
        expectedCod: booking.order.total,
        receivedAmount,
        courierFee,
        status: "RECONCILED",
        paymentReference: input.paymentReference || null,
        reconciledAt: new Date(),
      },
    });
    await tx.accountingTransaction.create({
      data: {
        type: "INCOME",
        amount: receivedAmount,
        description: `Gross COD remittance for ${booking.order.orderNumber}`,
        accountId: account.id,
        categoryId: incomeCategory.id,
        courierSettlementId: settlement.id,
        createdById: input.actorId,
      },
    });
    if (courierFee.gt(0)) {
      await tx.accountingTransaction.create({
        data: {
          type: "EXPENSE",
          amount: courierFee,
          description: `Courier fee for ${booking.order.orderNumber}`,
          accountId: account.id,
          categoryId: expenseCategory.id,
          courierSettlementId: settlement.id,
          createdById: input.actorId,
        },
      });
    }

    await writeActivityLog(tx, {
      actorId: input.actorId,
      action: "COURIER_COD_RECONCILED",
      entityType: "CourierSettlement",
      entityId: settlement.id,
      summary: `Reconciled COD remittance for ${booking.order.orderNumber}.`,
      details: {
        orderId: booking.orderId,
        expectedCod: booking.order.total.toFixed(2),
        receivedAmount: receivedAmount.toFixed(2),
        courierFee: courierFee.toFixed(2),
      },
    });
    return settlement;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
