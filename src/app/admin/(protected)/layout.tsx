import Link from "next/link";
import type { ReactNode } from "react";
import { logOut } from "./actions";
import { requireStaff } from "@/auth/authorization";
import "./admin.css";

export const instant = false;

export default async function OperationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireStaff();
  const canManageSettings = user.role === "ADMIN" || user.role === "MANAGER";

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin">
          <span className="admin-brand-mark" aria-hidden="true">
            CC
          </span>
          <span>
            <strong>Crazy Cart</strong>
            <span className="admin-brand-caption">অপারেশনস</span>
          </span>
        </Link>

        <nav className="admin-nav" aria-label="অপারেশনস নেভিগেশন">
          <span className="admin-nav-caption">ওয়ার্কস্পেস</span>
          <Link className="admin-nav-link" href="/admin">
            ওভারভিউ
          </Link>
          <span className="admin-nav-caption">অর্ডার ও বিক্রয়</span>
          <Link className="admin-nav-link" href="/admin/orders">
            অর্ডার
          </Link>
          <Link className="admin-nav-link" href="/admin/orders/scan">Order scan</Link>
          <Link className="admin-nav-link" href="/admin/pos">POS / offline queue</Link>
          <Link className="admin-nav-link" href="/admin/purchases">Purchases</Link>
          <Link className="admin-nav-link" href="/admin/customers">Customers</Link>
          {canManageSettings ? (
            <>
              <span className="admin-nav-caption">Finance & reports</span>
              <Link className="admin-nav-link" href="/admin/reports">Sales & reports</Link>
              <Link className="admin-nav-link" href="/admin/accounting">Transactions & accounts</Link>
              <Link className="admin-nav-link" href="/admin/accounting/payroll">Payroll</Link>
              <Link className="admin-nav-link" href="/admin/accounting/courier">Courier COD reconciliation</Link>
              <Link className="admin-nav-link" href="/admin/activity">Activity log</Link>
            </>
          ) : null}
          <span className="admin-nav-caption">ইনভেন্টরি</span>
          <Link className="admin-nav-link" href="/admin/inventory/products">
            পণ্য
          </Link>
          <Link className="admin-nav-link" href="/admin/stock">
            স্টক টুলস
          </Link>
          {canManageSettings ? (
            <>
              <Link className="admin-nav-link" href="/admin/inventory/digital-products">
                ডিজিটাল পণ্য
              </Link>
              <Link className="admin-nav-link" href="/admin/inventory/import">
                পণ্য ইমপোর্ট ও Reseller Sync
              </Link>
              <Link className="admin-nav-link" href="/admin/catalog">
                ক্যাটালগ টুলস
              </Link>
            </>
          ) : null}
          {canManageSettings ? (
            <Link className="admin-nav-link" href="/admin/settings">
              সাধারণ সেটিংস
            </Link>
          ) : null}
          {canManageSettings ? (
            <>
              <span className="admin-nav-caption">স্টোরফ্রন্ট</span>
              <Link className="admin-nav-link" href="/admin/offers">অফার পরিচালনা</Link>
              <Link className="admin-nav-link" href="/admin/reviews">রিভিউ moderation</Link>
            </>
          ) : null}
        </nav>

        <div className="admin-sidebar-foot">
          <span>BDT ৳</span>
          <span>প্ল্যাটফর্ম সেটআপ</span>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <p>অপারেশনস ড্যাশবোর্ড</p>
          <div className="admin-user">
            <span className="admin-user-name">{user.name ?? user.email}</span>
            <span className="admin-role">{user.role}</span>
            <form action={logOut}>
              <button className="admin-logout" type="submit">
                সাইন আউট
              </button>
            </form>
          </div>
        </header>
        <main className="admin-main" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
