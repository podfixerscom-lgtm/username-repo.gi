import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/auth/authorization";
import { getPrisma } from "@/lib/prisma";
import { moderateReview } from "../offers/actions";

export const metadata: Metadata = { title: "রিভিউ moderation | Crazy Cart Operations" };

export default async function ReviewsAdminPage() {
  await requireStaff(["ADMIN", "MANAGER"]);
  const reviews = await getPrisma().productReview.findMany({
    orderBy: [{ isApproved: "asc" }, { createdAt: "desc" }],
    include: { product: { select: { name: true, slug: true } } },
  });
  return (
    <section aria-labelledby="reviews-admin-title">
      <h1 className="admin-page-heading" id="reviews-admin-title">রিভিউ moderation</h1>
      <p className="admin-page-intro">গ্রাহকের জমা দেওয়া রিভিউ অনুমোদন করলে তা পণ্যের পৃষ্ঠায় প্রকাশিত হবে।</p>
      {reviews.length ? (
        <div className="admin-stack">
          {reviews.map((review) => (
            <article className="admin-panel" key={review.id}>
              <h2><Link href={`/shop/${review.product.slug}`}>{review.product.name}</Link> · {review.rating}/5</h2>
              <p>{review.title || "শিরোনাম নেই"} · {review.customerName}</p>
              <p>{review.body}</p>
              <p>{review.isApproved ? "অনুমোদিত" : "অপেক্ষমাণ"}</p>
              <form action={moderateReview}>
                <input type="hidden" name="reviewId" value={review.id} />
                <input type="hidden" name="approved" value={review.isApproved ? "false" : "true"} />
                <button className="admin-button admin-button-secondary" type="submit">
                  {review.isApproved ? "প্রকাশনা প্রত্যাহার" : "অনুমোদন"}
                </button>
              </form>
            </article>
          ))}
        </div>
      ) : <div className="admin-panel"><p>এখনো কোনো রিভিউ জমা হয়নি।</p></div>}
    </section>
  );
}
