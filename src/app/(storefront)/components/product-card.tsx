import Link from "next/link";
import Image from "next/image";

export type StoreProductCardData = {
  id: string;
  name: string;
  slug: string;
  price: { toString(): string };
  type: "PHYSICAL" | "DIGITAL";
  allowPreorder: boolean;
  variants: Array<{ price: { toString(): string }; stockOnHand: number }>;
  images: Array<{ url: string; altText: string }>;
};

export function ProductCard({ product }: { product: StoreProductCardData }) {
  const startingPrice = product.variants.length
    ? Math.min(...product.variants.map((variant) => Number(variant.price)))
    : Number(product.price);
  const image = product.images[0];
  const inStock = product.type === "DIGITAL" || product.variants.some((variant) => variant.stockOnHand > 0);

  return (
    <article className="store-product-card">
      <Link href={`/shop/${product.slug}`} className="store-product-image">
        {image ? <Image src={image.url} alt={image.altText} width={320} height={320} unoptimized /> : <span>{product.name}</span>}
      </Link>
      <div className="store-product-info">
        <h2><Link href={`/shop/${product.slug}`}>{product.name}</Link></h2>
        <p className="store-product-price">৳{startingPrice.toFixed(2)}</p>
        <p className="store-product-availability">
          {inStock ? "অর্ডারের জন্য উপলভ্য" : product.allowPreorder ? "Pre-order গ্রহণ করা হচ্ছে" : "স্টক নেই"}
        </p>
      </div>
    </article>
  );
}
