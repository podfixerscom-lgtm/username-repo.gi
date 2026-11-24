import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getPrisma } from "@/lib/prisma";
import { ProductPurchaseForm } from "../../components/product-purchase-form";
import { ProductViewEvent } from "../../components/product-view-event";
import { ReviewForm } from "../../components/review-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPrisma().product.findFirst({
    where: { slug, isActive: true },
    select: { name: true, description: true },
  });
  return product
    ? { title: product.name, description: product.description ?? undefined }
    : { title: "পণ্য পাওয়া যায়নি" };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getPrisma().product.findFirst({
    where: { slug, isActive: true },
    include: {
      variants: { where: { isActive: true }, orderBy: { createdAt: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
      category: { select: { name: true, slug: true } },
      reviews: {
        where: { isApproved: true },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, customerName: true, rating: true, title: true, body: true, createdAt: true },
      },
    },
  });
  if (!product) notFound();

  const displayPrice = product.variants.length
    ? Math.min(...product.variants.map((variant) => Number(variant.price)))
    : Number(product.price);

  return (
    <>
      <ProductViewEvent productId={product.id} name={product.name} price={displayPrice.toFixed(2)} />
      <article className="store-product-detail">
        <div className="product-gallery">
          {product.images.length ? product.images.map((image) => (
            <Image key={image.id} src={image.url} alt={image.altText} width={640} height={640} unoptimized />
          )) : <div className="product-image-placeholder" aria-hidden="true">{product.name}</div>}
        </div>
        <div className="product-detail-copy">
          {product.category ? <p><a href={`/shop?category=${encodeURIComponent(product.category.slug)}`}>{product.category.name}</a></p> : null}
          <h1>{product.name}</h1>
          <p className="store-product-price">৳{displayPrice.toFixed(2)}</p>
          {product.description ? <p className="product-description">{product.description}</p> : null}
          {product.type === "PHYSICAL" && product.sizeGuide ? (
            <details className="size-guide">
              <summary>Size guide দেখুন</summary>
              <p>{product.sizeGuide}</p>
            </details>
          ) : null}
          {product.type === "PHYSICAL" && product.allowPreorder ? <p className="store-info">স্টক না থাকলেও pre-order করা যাবে।</p> : null}
          {product.variants.length ? (
            <ProductPurchaseForm
              product={{
                id: product.id,
                name: product.name,
                slug: product.slug,
                type: product.type,
                allowPreorder: product.allowPreorder,
              }}
              variants={product.variants.map((variant) => ({
                id: variant.id,
                name: variant.name,
                sku: variant.sku,
                size: variant.size,
                color: variant.color,
                price: variant.price.toString(),
                stockOnHand: variant.stockOnHand,
              }))}
            />
          ) : <p className="store-empty">এই পণ্যটি এখন অর্ডার করা যাচ্ছে না।</p>}
        </div>
      </article>
      <section className="store-section" aria-labelledby="reviews-title">
        <h2 id="reviews-title">গ্রাহক রিভিউ</h2>
        {product.reviews.length ? (
          <ul className="store-review-list">
            {product.reviews.map((review) => (
              <li key={review.id}>
                <h3>{review.title || `${review.rating}/5 রেটিং`}</h3>
                <p className="review-rating">
                  <span className="visually-hidden">{review.rating} এর মধ্যে ৫ রেটিং</span>
                  <span aria-hidden="true">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
                </p>
                <p>{review.body}</p>
                <p className="review-author">{review.customerName}</p>
              </li>
            ))}
          </ul>
        ) : <p>এখনো কোনো অনুমোদিত রিভিউ নেই।</p>}
        <div className="review-form-panel">
          <h3>আপনার অভিজ্ঞতা শেয়ার করুন</h3>
          <p>প্রকাশের আগে রিভিউ moderation করা হবে।</p>
          <ReviewForm productId={product.id} />
        </div>
      </section>
    </>
  );
}
