import Link from "next/link";
import type { Metadata } from "next";
import { Prisma } from "@/generated/prisma/client";
import { requireStaff } from "@/auth/authorization";
import { getDhakaDate } from "@/lib/reports/date-range";
import { getPrisma } from "@/lib/prisma";
import {
  AccountingCategoryForm,
  AccountingTransactionForm,
  FinancialAccountForm,
} from "./forms";

export const metadata: Metadata = { title: "Accounting | Crazy Cart Operations" };

function formatBDT(value: string | Prisma.Decimal) {
  return `৳${Number(value).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function AccountingPage() {
  await requireStaff(["ADMIN", "MANAGER"]);
  const prisma = getPrisma();
  const [accounts, categories, transactions, movements, incomingTransfers] = await Promise.all([
    prisma.financialAccount.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    prisma.accountingCategory.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] }),
    prisma.accountingTransaction.findMany({
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        account: { select: { name: true } },
        destinationAccount: { select: { name: true } },
        category: { select: { name: true } },
        createdBy: { select: { name: true, email: true } },
      },
    }),
    prisma.accountingTransaction.groupBy({
      by: ["accountId", "type"],
      _sum: { amount: true },
    }),
    prisma.accountingTransaction.groupBy({
      by: ["destinationAccountId"],
      where: { type: "TRANSFER", destinationAccountId: { not: null } },
      _sum: { amount: true },
    }),
  ]);
  const movementTotals = new Map<string, { income: Prisma.Decimal; outflow: Prisma.Decimal }>();
  for (const movement of movements) {
    const total = movementTotals.get(movement.accountId) ?? {
      income: new Prisma.Decimal(0),
      outflow: new Prisma.Decimal(0),
    };
    const amount = movement._sum.amount ?? new Prisma.Decimal(0);
    if (movement.type === "INCOME") total.income = total.income.plus(amount);
    else total.outflow = total.outflow.plus(amount);
    movementTotals.set(movement.accountId, total);
  }
  const receivedTransfers = new Map(
    incomingTransfers.flatMap((movement) => movement.destinationAccountId
      ? [[movement.destinationAccountId, movement._sum.amount ?? new Prisma.Decimal(0)] as const]
      : []),
  );
  const balances = new Map(accounts.map((account) => {
    const movement = movementTotals.get(account.id);
    const balance = account.openingBalance
      .plus(movement?.income ?? 0)
      .minus(movement?.outflow ?? 0)
      .plus(receivedTransfers.get(account.id) ?? 0);
    return [account.id, balance] as const;
  }));
  const activeAccounts = accounts.filter((account) => account.isActive);
  const incomeCategories = categories.filter((category) => category.isActive && category.type === "INCOME");
  const expenseCategories = categories.filter((category) => category.isActive && category.type === "EXPENSE");

  return (
    <section aria-labelledby="accounting-title">
      <h1 className="admin-page-heading" id="accounting-title">Transactions & Accounts</h1>
      <p className="admin-page-intro">Income, expenses, account transfers and payroll payments are recorded as append-only ledger entries. Amounts are shown in BDT (৳).</p>
      <div className="admin-actions">
        <Link className="admin-button admin-button-secondary" href="/admin/accounting/payroll">Payroll</Link>
        <Link className="admin-button admin-button-secondary" href="/admin/accounting/courier">Courier COD reconciliation</Link>
        <Link className="admin-button admin-button-secondary" href="/admin/activity">Activity log</Link>
        <Link className="admin-button admin-button-secondary" href="/admin/reports">Sales & more reports</Link>
      </div>

      <section className="admin-panel" aria-labelledby="accounts-title">
        <h2 id="accounts-title">Financial accounts</h2>
        <p>Opening balances and posted transactions determine the recorded balance. Full account numbers and payment credentials should not be stored here.</p>
        {accounts.length ? (
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <caption>Financial accounts and current recorded balances</caption>
              <thead><tr><th scope="col">Account</th><th scope="col">Type</th><th scope="col">Opening</th><th scope="col">Current balance</th><th scope="col">Status</th></tr></thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <th scope="row">{account.name}{account.provider ? ` · ${account.provider}` : ""}{account.accountReference ? ` · ${account.accountReference}` : ""}</th>
                    <td>{account.type.replaceAll("_", " ")}</td>
                    <td>{formatBDT(account.openingBalance)}</td>
                    <td>{formatBDT(balances.get(account.id) ?? account.openingBalance)}</td>
                    <td>{account.isActive ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p>No financial accounts yet. Create a cash, bank, or mobile banking account to begin recording transactions.</p>}
        <FinancialAccountForm />
      </section>

      <section className="admin-panel" aria-labelledby="categories-title">
        <h2 id="categories-title">Income & expense categories</h2>
        {categories.length ? (
          <ul className="admin-inline-list">
            {categories.map((category) => (
              <li key={category.id}>
                <strong>{category.name}</strong>
                <span>{category.type} · {category.isActive ? "Active" : "Inactive"}</span>
              </li>
            ))}
          </ul>
        ) : <p>No accounting categories yet. Run the database seed, or create one below.</p>}
        <AccountingCategoryForm />
      </section>

      <section className="admin-panel" aria-labelledby="record-transaction-title">
        <h2 id="record-transaction-title">Record a transaction</h2>
        <p>Entries cannot be edited or deleted after posting. Record a correcting entry to offset a mistake.</p>
        <div className="admin-card-grid">
          <section className="admin-subpanel" aria-labelledby="income-title">
            <h3 id="income-title">Income</h3>
            <AccountingTransactionForm type="INCOME" accounts={activeAccounts} categories={incomeCategories} today={getDhakaDate()} />
          </section>
          <section className="admin-subpanel" aria-labelledby="expense-title">
            <h3 id="expense-title">Expense</h3>
            <AccountingTransactionForm type="EXPENSE" accounts={activeAccounts} categories={expenseCategories} today={getDhakaDate()} />
          </section>
          <section className="admin-subpanel" aria-labelledby="transfer-title">
            <h3 id="transfer-title">Account transfer</h3>
            <AccountingTransactionForm type="TRANSFER" accounts={activeAccounts} categories={[]} today={getDhakaDate()} />
          </section>
        </div>
      </section>

      <section className="admin-panel" aria-labelledby="ledger-title">
        <h2 id="ledger-title">Recent ledger entries</h2>
        {transactions.length ? (
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <caption>Most recent 100 posted accounting transactions</caption>
              <thead><tr><th scope="col">Date</th><th scope="col">Type</th><th scope="col">Description</th><th scope="col">Account movement</th><th scope="col">Category</th><th scope="col">Amount</th><th scope="col">Recorded by</th></tr></thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td><time dateTime={transaction.occurredAt.toISOString()}>{transaction.occurredAt.toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })}</time></td>
                    <td>{transaction.type}</td>
                    <td>{transaction.description}</td>
                    <td>{transaction.type === "TRANSFER"
                      ? `${transaction.account.name} → ${transaction.destinationAccount?.name ?? "Unknown"}`
                      : transaction.account.name}</td>
                    <td>{transaction.category?.name ?? "Account transfer"}</td>
                    <td>{formatBDT(transaction.amount)}</td>
                    <td>{transaction.createdBy?.name ?? transaction.createdBy?.email ?? "System"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p>No ledger transactions yet.</p>}
      </section>
    </section>
  );
}
