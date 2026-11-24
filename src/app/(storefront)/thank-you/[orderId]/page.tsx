import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "অর্ডার গ্রহণ করা হয়েছে" };

export default async function ThankYouPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await getPrisma().order.findUnique({
    where: { id: orderId },
    select: {
      orderNumber: true,
      status: true,
      paymentMethod: true,
      paymentState: true,
      total: true,
      hasPreorder: true,
      items: { select: { product: { select: { type: true } } } },
    },
  });
  if (!order) notFound();

  return (
    <section className="thank-you-panel" aria-labelledby="thank-you-title">
      <h1 id="thank-you-title">ধন্যবাদ! আপনার অর্ডার গ্রহণ করা হয়েছে।</h1>
      <p>অর্ডার নম্বর <strong>{order.orderNumber}</strong></p>
      <p>মোট: <strong>৳{order.total.toFixed(2)}</strong></p>
      <p>অর্ডারের অবস্থা: <strong>{order.status}</strong></p>
      {order.hasPreorder ? <p>অর্ডারে pre-order পণ্য আছে; স্টক নিশ্চিত হলে অপারেশনস টিম অর্ডারটি এগিয়ে নেবে।</p> : null}
      {order.items.some((item) => item.product.type === "DIGITAL") ? (
        <p>ডিজিটাল asset delivery এখনো স্বয়ংক্রিয় নয়; অপারেশনস টিম order status অনুযায়ী ব্যবস্থা নেবে।</p>
      ) : null}
      {order.paymentMethod !== "COD" && order.paymentState !== "SUCCEEDED" ? (
        <p>Online payment এখনো সংযুক্ত নয়। আপনার অর্ডার payment confirmation-এর অপেক্ষায় আছে; কোনো অর্থপ্রদান সম্পন্ন হয়নি।</p>
      ) : null}
      <Link className="store-button" href="/shop">আরও কেনাকাটা করুন</Link>
    </section>
  );
}
