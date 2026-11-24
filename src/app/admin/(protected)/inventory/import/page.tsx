import type { Metadata } from "next";
import { requireStaff } from "@/auth/authorization";
import { getPrisma } from "@/lib/prisma";
import { CreateSourceForm, SourceOperations, SourceSettingsForm } from "./source-forms";

export const metadata: Metadata = { title: "পণ্য ইমপোর্ট ও Reseller API Sync | Crazy Cart Operations" };

export default async function ImportProductsPage() {
  await requireStaff(["ADMIN", "MANAGER"]);
  const sources = await getPrisma().resellerSource.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      baseUrl: true,
      authType: true,
      markupType: true,
      markupValue: true,
      isActive: true,
      lastSyncedAt: true,
    },
  });

  return (
    <section aria-labelledby="import-title">
      <h1 className="admin-page-heading" id="import-title">পণ্য ইমপোর্ট ও Reseller API Sync</h1>
      <p className="admin-page-intro">
        HTTPS JSON catalog endpoint সংযুক্ত করুন, BDT markup নির্ধারণ করুন, তারপর পরীক্ষা বা ম্যানুয়ালি সিঙ্ক করুন।
        API key এনক্রিপ্ট করে রাখা হয়; সংরক্ষিত secret কখনো এখানে দেখানো হয় না।
      </p>

      <section className="admin-panel" aria-labelledby="create-source-title">
        <h2 id="create-source-title">রিসেলার সোর্স যোগ করুন</h2>
        <CreateSourceForm />
      </section>

      <section className="admin-panel" aria-labelledby="sources-title">
        <h2 id="sources-title">সংযুক্ত সোর্স</h2>
        {sources.length ? (
          <div className="admin-stack">
            {sources.map((source) => (
              <article className="admin-subpanel" key={source.id}>
                <h3>{source.name}</h3>
                <p className="admin-mono">{source.baseUrl}</p>
                <p>
                  {source.authType === "BEARER" ? "Bearer authentication" : "X-API-Key authentication"}
                  {" · "}
                  {source.markupType === "PERCENTAGE"
                    ? `${source.markupValue.toString()}% markup`
                    : `৳${source.markupValue.toString()} fixed markup`}
                  {" · "}
                  {source.isActive ? "সক্রিয়" : "নিষ্ক্রিয়"}
                  {" · "}
                  {source.lastSyncedAt
                    ? `সর্বশেষ সিঙ্ক ${source.lastSyncedAt.toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}`
                    : "এখনো সিঙ্ক হয়নি"}
                </p>
                <SourceSettingsForm source={{
                  ...source,
                  markupValue: source.markupValue.toString(),
                  lastSyncedAt: source.lastSyncedAt?.toISOString() ?? null,
                }} />
                <SourceOperations sourceId={source.id} />
              </article>
            ))}
          </div>
        ) : <p>এখনো কোনো রিসেলার সোর্স যোগ করা হয়নি।</p>}
      </section>
    </section>
  );
}
