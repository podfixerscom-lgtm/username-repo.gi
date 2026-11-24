"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/action-state";
import {
  addAccountingCategory,
  addAccountingTransaction,
  addFinancialAccount,
  addPayrollRecord,
  payPayroll,
  reconcileCourierCod,
} from "./actions";

type AccountOption = { id: string; name: string; type: string };
type CategoryOption = { id: string; name: string };

export function FinancialAccountForm() {
  const [state, action, pending] = useActionState(addFinancialAccount, {});
  return (
    <form action={action} className="admin-form">
      <div className="admin-form-grid">
        <label className="admin-field" htmlFor="account-name">Account name
          <input id="account-name" name="name" minLength={2} maxLength={120} required />
        </label>
        <label className="admin-field" htmlFor="account-type">Account type
          <select id="account-type" name="type" defaultValue="CASH">
            <option value="CASH">Cash</option>
            <option value="BANK">Bank</option>
            <option value="MOBILE_WALLET">Mobile banking</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label className="admin-field" htmlFor="account-provider">Provider or bank (optional)
          <input id="account-provider" name="provider" maxLength={80} />
        </label>
        <label className="admin-field" htmlFor="account-reference">Masked reference / last four digits (optional)
          <input id="account-reference" name="accountReference" maxLength={80} aria-describedby="account-reference-help" />
          <span className="admin-field-help" id="account-reference-help">Do not enter a full account number, PIN, or password.</span>
        </label>
        <label className="admin-field" htmlFor="account-opening-balance">Opening balance (৳)
          <input id="account-opening-balance" name="openingBalance" type="number" min="0" step="0.01" inputMode="decimal" defaultValue="0" required />
        </label>
      </div>
      <Feedback state={state} />
      <button className="admin-button" type="submit" disabled={pending}>{pending ? "Creating…" : "Create account"}</button>
    </form>
  );
}

export function AccountingCategoryForm() {
  const [state, action, pending] = useActionState(addAccountingCategory, {});
  return (
    <form action={action} className="admin-form">
      <div className="admin-form-grid">
        <label className="admin-field" htmlFor="accounting-category-name">Category name
          <input id="accounting-category-name" name="name" minLength={2} maxLength={100} required />
        </label>
        <label className="admin-field" htmlFor="accounting-category-type">Category type
          <select id="accounting-category-type" name="type" defaultValue="EXPENSE">
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
          </select>
        </label>
      </div>
      <Feedback state={state} />
      <button className="admin-button admin-button-secondary" type="submit" disabled={pending}>{pending ? "Saving…" : "Add category"}</button>
    </form>
  );
}

export function AccountingTransactionForm({
  type,
  accounts,
  categories,
  today,
}: {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  accounts: AccountOption[];
  categories: CategoryOption[];
  today: string;
}) {
  const [state, action, pending] = useActionState(addAccountingTransaction, {});
  const prefix = `ledger-${type.toLowerCase()}`;
  const unavailable = accounts.length < (type === "TRANSFER" ? 2 : 1) ||
    (type !== "TRANSFER" && categories.length === 0);
  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="type" value={type} />
      <div className="admin-form-grid">
        <label className="admin-field" htmlFor={`${prefix}-amount`}>Amount (৳)
          <input id={`${prefix}-amount`} name="amount" type="number" min="0.01" step="0.01" inputMode="decimal" required />
        </label>
        <label className="admin-field" htmlFor={`${prefix}-date`}>Transaction date
          <input id={`${prefix}-date`} name="occurredAt" type="date" defaultValue={today} required />
        </label>
        <label className="admin-field" htmlFor={`${prefix}-account`}>{type === "TRANSFER" ? "From account" : "Account"}
          <select id={`${prefix}-account`} name="accountId" required defaultValue="">
            <option value="" disabled>Select account</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.type.replace("_", " ")}</option>)}
          </select>
        </label>
        {type === "TRANSFER" ? (
          <label className="admin-field" htmlFor={`${prefix}-destination`}>To account
            <select id={`${prefix}-destination`} name="destinationAccountId" required defaultValue="">
              <option value="" disabled>Select destination</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </label>
        ) : (
          <label className="admin-field" htmlFor={`${prefix}-category`}>Category
            <select id={`${prefix}-category`} name="categoryId" required defaultValue="">
              <option value="" disabled>Select category</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
        )}
        <label className="admin-field admin-field-wide" htmlFor={`${prefix}-description`}>Description
          <textarea id={`${prefix}-description`} name="description" rows={2} minLength={2} maxLength={2000} required />
        </label>
      </div>
      <Feedback state={state} />
      <button className="admin-button" type="submit" disabled={pending || unavailable}>
        {pending ? "Posting…" : `Record ${type.toLowerCase()}`}
      </button>
      {unavailable ? <p className="admin-field-help">Add the required active accounts and categories before recording this entry.</p> : null}
    </form>
  );
}

export function PayrollRecordForm({
  employees,
  period,
}: {
  employees: Array<{ id: string; name: string; email: string; role: string }>;
  period: string;
}) {
  const [state, action, pending] = useActionState(addPayrollRecord, {});
  return (
    <form action={action} className="admin-form">
      <div className="admin-form-grid">
        <label className="admin-field" htmlFor="payroll-employee">Staff member
          <select id="payroll-employee" name="employeeId" required defaultValue="">
            <option value="" disabled>Select staff member</option>
            {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.role}</option>)}
          </select>
        </label>
        <label className="admin-field" htmlFor="payroll-period">Payroll period
          <input id="payroll-period" name="period" type="month" defaultValue={period} required />
        </label>
        <label className="admin-field" htmlFor="payroll-base-salary">Base salary (৳)
          <input id="payroll-base-salary" name="baseSalary" type="number" min="0" step="0.01" inputMode="decimal" required />
        </label>
        <label className="admin-field" htmlFor="payroll-allowances">Allowances (৳)
          <input id="payroll-allowances" name="allowances" type="number" min="0" step="0.01" inputMode="decimal" defaultValue="0" required />
        </label>
        <label className="admin-field" htmlFor="payroll-deductions">Deductions (৳)
          <input id="payroll-deductions" name="deductions" type="number" min="0" step="0.01" inputMode="decimal" defaultValue="0" required />
        </label>
      </div>
      <Feedback state={state} />
      <button className="admin-button" type="submit" disabled={pending || employees.length === 0}>
        {pending ? "Preparing…" : "Prepare payroll"}
      </button>
    </form>
  );
}

export function PayPayrollForm({
  payrollId,
  accounts,
}: {
  payrollId: string;
  accounts: AccountOption[];
}) {
  const [state, action, pending] = useActionState(payPayroll, {});
  const selectId = `payroll-account-${payrollId}`;
  return (
    <form action={action} className="admin-actions">
      <input type="hidden" name="payrollId" value={payrollId} />
      <label className="admin-field" htmlFor={selectId}>Pay from
        <select id={selectId} name="accountId" required defaultValue="">
          <option value="" disabled>Select account</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
      </label>
      <button className="admin-button admin-button-secondary" type="submit" disabled={pending || accounts.length === 0}>
        {pending ? "Posting…" : "Mark paid"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function CourierSettlementForm({
  booking,
  accounts,
}: {
  booking: { id: string; orderNumber: string; provider: string; expectedCod: string };
  accounts: AccountOption[];
}) {
  const [state, action, pending] = useActionState(reconcileCourierCod, {});
  const prefix = `courier-settlement-${booking.id}`;
  return (
    <form action={action} className="admin-form">
      <input type="hidden" name="bookingId" value={booking.id} />
      <div className="admin-form-grid">
        <label className="admin-field" htmlFor={`${prefix}-account`}>Receiving account
          <select id={`${prefix}-account`} name="accountId" required defaultValue="">
            <option value="" disabled>Select account</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </label>
        <label className="admin-field" htmlFor={`${prefix}-received`}>Gross COD remitted before fee (৳)
          <input id={`${prefix}-received`} name="receivedAmount" type="number" min="0.01" step="0.01" inputMode="decimal" defaultValue={booking.expectedCod} required />
        </label>
        <label className="admin-field" htmlFor={`${prefix}-fee`}>Courier fee withheld (৳)
          <input id={`${prefix}-fee`} name="courierFee" type="number" min="0" step="0.01" inputMode="decimal" defaultValue="0" required />
        </label>
        <label className="admin-field" htmlFor={`${prefix}-reference`}>Payment reference (optional)
          <input id={`${prefix}-reference`} name="paymentReference" maxLength={160} />
        </label>
      </div>
      <p className="admin-field-help">Expected COD: ৳{booking.expectedCod}. Enter gross remittance; net bank receipt is gross minus courier fee. This posts income and fee expense together.</p>
      <Feedback state={state} />
      <button className="admin-button" type="submit" disabled={pending || accounts.length === 0}>
        {pending ? "Reconciling…" : `Reconcile ${booking.provider} · ${booking.orderNumber}`}
      </button>
    </form>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (state.error) return <p className="admin-feedback admin-feedback-error" role="alert">{state.error}</p>;
  if (state.success) return <p className="admin-feedback admin-feedback-success" role="status">{state.success}</p>;
  return null;
}
