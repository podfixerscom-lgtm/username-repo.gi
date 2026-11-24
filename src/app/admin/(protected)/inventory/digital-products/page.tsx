import type { Metadata } from "next";
import { requireStaff } from "@/auth/authorization";
import { getPrisma } from "@/lib/prisma";
import { retireDigitalAsset } from "./actions";
import { DigitalAssetForm } from "./digital-asset-form";

export const metadata: Metadata = { title: "ডিজিটাল পণ্য | Crazy Cart Operations" };

export default async function DigitalProductsPage() {
  await requireStaff(["ADMIN", "MANAGER"]);
  const prisma = getPrisma();
  const [products, variants, assets] = await Promise.all([
    prisma.product.findMany({
      where: { type: "DIGITAL" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.productVariant.findMany({
      where: { product: { type: "DIGITAL" } },
      orderBy: [{ product: { name: "asc" } }, { sku: "asc" }],
      select: { id: true, sku: true, product: { select: { name: true } } },
    }),
    prisma.digitalAsset.findMany({
      where: { product: { type: "DIGITAL" } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        type: true,
        label: true,
        fileName: true,
        downloadUrl: true,
        isAvailable: true,
        createdAt: true,
        product: { select: { name: true } },
        variant: { select: { sku: true } },
      },
    }),
  ]);

  return (
    <section aria-labelledby="digital-products-title">
      <h1 className="admin-page-heading" id="digital-products-title">ডিজিটাল পণ্য</h1>
      <p className="admin-page-intro">ডাউনলোড URL রেফারেন্স ও এনক্রিপ্টেড লাইসেন্স কী পরিচালনা করুন। ডিজিটাল ডেলিভারি checkout-এ সংযুক্ত নয়।</p>

      <section className="admin-panel" aria-labelledby="download-assets-title">
        <h2 id="download-assets-title">ডাউনলোড রেফারেন্স যোগ</h2>
        <DigitalAssetForm
          products={products}
          variants={variants.map((variant) => ({
            id: variant.id,
            sku: variant.sku,
            productName: variant.product.name,
          }))}
          type="DOWNLOAD"
        />
      </section>

      <section className="admin-panel" aria-labelledby="license-assets-title">
        <h2 id="license-assets-title">লাইসেন্স কী যোগ</h2>
        <DigitalAssetForm
          products={products}
          variants={variants.map((variant) => ({
            id: variant.id,
            sku: variant.sku,
            productName: variant.product.name,
          }))}
          type="LICENSE_KEY"
        />
      </section>

      <section className="admin-panel" aria-labelledby="digital-assets-list-title">
        <h2 id="digital-assets-list-title">সংরক্ষিত ডিজিটাল সম্পদ</h2>
        {assets.length ? (
          <ul className="admin-plain-list">
            {assets.map((asset) => (
              <li className="admin-image-row" key={asset.id}>
                <div>
                  <strong>{asset.label}</strong>
                  <p>{asset.product.name}{asset.variant ? ` · ${asset.variant.sku}` : ""}</p>
                  <p className="admin-field-help">
                    {asset.type === "DOWNLOAD" ? `ডাউনলোড · ${asset.fileName ?? "ফাইল নাম নেই"}` : "লাইসেন্স কী · মান এনক্রিপ্টেড"}
                    {" · "}{asset.isAvailable ? "সক্রিয়" : "অব্যবহৃত"}
                  </p>
                  {asset.type === "DOWNLOAD" && asset.downloadUrl ? (
                    <a className="admin-text-link" href={asset.downloadUrl}>{asset.fileName ?? "ডাউনলোড রেফারেন্স"}</a>
                  ) : null}
                </div>
                {asset.isAvailable ? (
                  <form action={retireDigitalAsset}>
                    <input type="hidden" name="assetId" value={asset.id} />
                    <button className="admin-button admin-button-danger" type="submit">নিষ্ক্রিয় করুন</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : <p>এখনো কোনো ডিজিটাল সম্পদ সংরক্ষণ করা হয়নি।</p>}
      </section>
    </section>
  );
}
