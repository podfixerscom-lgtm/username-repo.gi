import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/auth/authorization";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Activity log | Crazy Cart Operations" };

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; q?: string }>;
}) {
  await requireStaff(["ADMIN", "MANAGER"]);
  const filters = await searchParams;
  const action = filters.action?.trim().slice(0, 80) ?? "";
  const query = filters.q?.trim().slice(0, 120) ?? "";
  const logs = await getPrisma().activityLog.findMany({
    where: {
      ...(action ? { action: { contains: action, mode: "insensitive" } } : {}),
      ...(query ? {
        OR: [
          { entityType: { contains: query, mode: "insensitive" } },
          { entityId: { contains: query, mode: "insensitive" } },
          { summary: { contains: query, mode: "insensitive" } },
        ],
      } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { actor: { select: { name: true, email: true } } },
  });

  return (
    <section aria-labelledby="activity-log-title">
      <Link className="admin-back-link" href="/admin/accounting">Back to accounting</Link>
      <h1 className="admin-page-heading" id="activity-log-title">Activity log</h1>
      <p className="admin-page-intro">Append-only records of important order, inventory, account, payroll, and COD reconciliation actions. The newest 200 matching events are shown.</p>
      <form className="admin-panel admin-form" method="get" aria-label="Filter activity log">
        <div className="admin-form-grid">
          <label className="admin-field" htmlFor="activity-filter-action">Action
            <input id="activity-filter-action" name="action" maxLength={80} defaultValue={action} />
          </label>
          <label className="admin-field" htmlFor="activity-filter-query">Entity or summary
            <input id="activity-filter-query" name="q" maxLength={120} defaultValue={query} />
          </label>
        </div>
        <button className="admin-button" type="submit">Filter activity</button>
      </form>

      <section className="admin-panel" aria-labelledby="activity-events-title">
        <h2 id="activity-events-title">Recent events ({logs.length})</h2>
        {logs.length ? (
          <div className="admin-table-scroll">
            <table className="admin-data-table">
              <caption>Recent important system changes</caption>
              <thead><tr><th scope="col">Time</th><th scope="col">Actor</th><th scope="col">Action</th><th scope="col">Entity</th><th scope="col">Summary</th></tr></thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td><time dateTime={log.createdAt.toISOString()}>{log.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}</time></td>
                    <td>{log.actor?.name ?? log.actor?.email ?? "System"}</td>
                    <td><code>{log.action}</code></td>
                    <td>{log.entityType} · <span className="admin-mono">{log.entityId}</span></td>
                    <td>{log.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p>No matching activity has been recorded.</p>}
      </section>
    </section>
  );
}
