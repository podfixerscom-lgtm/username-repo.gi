import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/auth/authorization";
import { getDhakaDate } from "@/lib/reports/date-range";
import { getPrisma } from "@/lib/prisma";
import { PayPayrollForm, PayrollRecordForm } from "../forms";

export const metadata: Metadata = { title: "Payroll | Crazy Cart Operations" };

function money(value: { toFixed: (digits: number) => string }) {
  return `৳${Number(value.toFixed(2)).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function PayrollPage() {
  await requireStaff(["ADMIN", "MANAGER"]);
  const prisma = getPrisma();
  const [employees, accounts, payrollRecords] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.financialAccount.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true },
    }),
    prisma.payrollRecord.findMany({
      orderBy: [{ period: "desc" }, { createdAt: "desc" }],
      take: 100,
      include: {
        employee: { select: { name: true, email: true, role: true } },
        createdBy: { select: { name: true, email: true } },
      },
    }),
  ]);
  const today = getDhakaDate();

  return (
    <section aria-labelledby="payroll-title">
      <Link className="admin-back-link" href="/admin/accounting">Back to accounting</Link>
      <h1 className="admin-page-heading" id="payroll-title">Staff payroll</h1>
      <p className="admin-page-intro">Prepare one payroll record per staff member and month. Marking it paid posts the net amount as an expense transaction. Tax, statutory benefits, and payslip delivery are not configured.</p>

      <section className="admin-panel" aria-labelledby="prepare-payroll-title">
        <h2 id="prepare-payroll-title">Prepare payroll</h2>
        <PayrollRecordForm employees={employees} period={today.slice(0, 7)} />
      </section>

      <section className="admin-panel" aria-labelledby="payroll-records-title">
        <h2 id="payroll-records-title">Payroll records</h2>
        {payrollRecords.length ? (
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <caption>Recent staff payroll records</caption>
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col">Staff member</th>
                  <th scope="col">Base salary</th>
                  <th scope="col">Allowances</th>
                  <th scope="col">Deductions</th>
                  <th scope="col">Net pay</th>
                  <th scope="col">Status</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {payrollRecords.map((record) => (
                  <tr key={record.id}>
                    <td>{record.period}</td>
                    <th scope="row">{record.employee.name} · {record.employee.role}</th>
                    <td>{money(record.baseSalary)}</td>
                    <td>{money(record.allowances)}</td>
                    <td>{money(record.deductions)}</td>
                    <td>{money(record.netPay)}</td>
                    <td>{record.status}{record.paidAt ? ` · ${record.paidAt.toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })}` : ""}</td>
                    <td>{record.status === "DRAFT" ? (
                      <PayPayrollForm payrollId={record.id} accounts={accounts} />
                    ) : <span>Paid and posted</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p>No payroll records yet.</p>}
      </section>
    </section>
  );
}
