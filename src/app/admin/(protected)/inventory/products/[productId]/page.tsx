import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaff } from "@/auth/authorization";
import { getPrisma } from "@/lib/prisma";
import { removeProductImage } from "../../actions";
import {
  AddImageForm,
  AddVariantForm,
  ProductSettingsForm,
  VariantEditForm,
} from "../product-edit-forms";

export const metadata: Metadata = { title: "পণ্য সম্পাদনা | Crazy Cart Operations" };

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const user = await requireStaff();
  const canEdit = user.role !== "STAFF";
  const { productId } = await params;
  const prisma = getPrisma();
  const [product, categories, brands, shippingClasses] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: { orderBy: { createdAt: "asc" } },
        images: { orderBy: { sortOrder: "asc" } },
        externalSource: { select: { name: true } },
        shippingClass: { select: { name: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.shippingClass.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!product) notFound();

  return (
    <section aria-labelledby="product-title">
      <Link className="admin-back-link" href="/admin/inventory/products">← পণ্যের তালিকায় ফিরুন</Link>
      <h1 className="admin-page-heading" id="product-title">{product.name}</h1>
      <p className="admin-page-intro">
        {product.type === "DIGITAL" ? "ডিজিটাল" : "ফিজিক্যাল"} পণ্য
        {product.isResellerProduct ? ` · রিসেলার: ${product.externalSource?.name ?? "সোর্স নেই"}` : ""}
      </p>

      <section className="admin-panel" aria-labelledby="product-settings-title">
        <h2 id="product-settings-title">পণ্যের তথ্য</h2>
        {canEdit ? (
          <ProductSettingsForm
            product={{
              id: product.id,
              name: product.name,
              description: product.description,
              price: product.price.toString(),
              categoryId: product.categoryId,
              brandId: product.brandId,
              shippingClassId: product.shippingClassId,
              weightGrams: product.weightGrams,
              allowPreorder: product.allowPreorder,
              sizeGuide: product.sizeGuide,
            }}
            categories={categories}
            brands={brands}
            shippingClasses={shippingClasses}
          />
        ) : (
          <dl className="admin-inline-details">
            <div><dt>SKU</dt><dd>{product.variants.map((variant) => variant.sku).join(", ") || "—"}</dd></div>
            <div><dt>মূল্য</dt><dd>৳{product.price.toFixed(2)}</dd></div>
            <div><dt>Shipping class</dt><dd>{product.shippingClass?.name ?? "Standard"}</dd></div>
            <div><dt>ওজন</dt><dd>{product.weightGrams} গ্রাম</dd></div>
            <div><dt>Pre-order</dt><dd>{product.allowPreorder ? "অনুমোদিত" : "বন্ধ"}</dd></div>
            <div><dt>ক্যাটাগরি</dt><dd>{product.categoryId ? categories.find((category) => category.id === product.categoryId)?.name ?? "—" : "—"}</dd></div>
            <div><dt>ব্র্যান্ড</dt><dd>{product.brandId ? brands.find((brand) => brand.id === product.brandId)?.name ?? "—" : "—"}</dd></div>
            {product.description ? <div className="admin-field-wide"><dt>বিবরণ</dt><dd>{product.description}</dd></div> : null}
          </dl>
        )}
      </section>

      <section className="admin-panel" aria-labelledby="variants-title">
        <h2 id="variants-title">ভ্যারিয়েন্ট</h2>
        {product.variants.length ? (
          <div className="admin-stack">
            {product.variants.map((variant) => (
              <article className="admin-subpanel" key={variant.id}>
                <h3>{variant.sku}</h3>
                {canEdit ? (
                  <VariantEditForm
                    productId={product.id}
                    variant={{
                      id: variant.id,
                      name: variant.name,
                      sku: variant.sku,
                      size: variant.size,
                      color: variant.color,
                      price: variant.price.toString(),
                      stockOnHand: variant.stockOnHand,
                      isActive: variant.isActive,
                    }}
                  />
                ) : (
                  <dl className="admin-inline-details">
                    <div><dt>ভ্যারিয়েন্ট</dt><dd>{variant.name ?? "—"}</dd></div>
                    <div><dt>মূল্য</dt><dd>৳{variant.price.toFixed(2)}</dd></div>
                    <div><dt>সাইজ</dt><dd>{variant.size ?? "—"}</dd></div>
                    <div><dt>রং</dt><dd>{variant.color ?? "—"}</dd></div>
                    <div><dt>স্টক</dt><dd>{variant.stockOnHand} ইউনিট</dd></div>
                    <div><dt>অবস্থা</dt><dd>{variant.isActive ? "সক্রিয়" : "নিষ্ক্রিয়"}</dd></div>
                  </dl>
                )}
              </article>
            ))}
          </div>
        ) : <p>এই পণ্যে এখনো কোনো ভ্যারিয়েন্ট নেই।</p>}
        {canEdit ? (
          <>
            <h3 className="admin-subsection-heading">ভ্যারিয়েন্ট যোগ</h3>
            <AddVariantForm productId={product.id} />
          </>
        ) : null}
      </section>

      <section className="admin-panel" aria-labelledby="images-title">
        <h2 id="images-title">পণ্যের ছবি</h2>
        {product.images.length ? (
          <ul className="admin-plain-list">
            {product.images.map((image) => (
              <li className="admin-image-row" key={image.id}>
                <div>
                  <strong>{image.altText}</strong>
                  <p className="admin-mono">{image.url}</p>
                  {image.externalSourceId ? <span className="admin-field-help">রিসেলার সিঙ্ক থেকে এসেছে</span> : null}
                </div>
                {canEdit ? (
                  <form action={removeProductImage}>
                    <input type="hidden" name="imageId" value={image.id} />
                    <input type="hidden" name="productId" value={product.id} />
                    <button className="admin-button admin-button-danger" type="submit">ছবি সরান</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : <p>এই পণ্যে এখনো কোনো ছবি নেই।</p>}
        {canEdit ? (
          <>
            <h3 className="admin-subsection-heading">ছবি যোগ</h3>
            <AddImageForm productId={product.id} />
          </>
        ) : null}
      </section>

      <p className="admin-page-intro">ভ্যারিয়েন্টের স্টক FIFO ব্যাচসহ পরিচালনা করতে <Link href="/admin/stock">Stock Tools</Link> খুলুন।</p>
      {product.sizeGuide ? (
        <section className="admin-panel" aria-labelledby="size-guide-title">
          <h2 id="size-guide-title">Size guide</h2>
          <p>{product.sizeGuide}</p>
        </section>
      ) : null}
    </section>
  );
}
