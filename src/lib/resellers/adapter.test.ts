import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeResellerPayload } from "./adapter";

describe("normalizeResellerPayload", () => {
  it("normalizes an enveloped catalog with product and variant defaults", () => {
    const [product] = normalizeResellerPayload({
      data: {
        products: [{
          external_product_id: "shirt-1",
          title: "Blue shirt",
          description: "Cotton shirt",
          supplier_price: "120.50",
          stock: 7,
          images: [{ url: "https://cdn.example/shirt.jpg", alt_text: "Blue shirt" }],
          variants: [{ id: 21, sku: "SUP-21", size: "M", color: "Blue" }],
        }],
      },
    });

    assert.deepEqual(product, {
      externalProductId: "shirt-1",
      title: "Blue shirt",
      description: "Cotton shirt",
      images: [{ url: "https://cdn.example/shirt.jpg", altText: "Blue shirt" }],
      variants: [{
        externalVariantId: "21",
        externalSku: "SUP-21",
        name: null,
        size: "M",
        color: "Blue",
        stock: 7,
        supplierPrice: "120.50",
      }],
    });
  });

  it("creates a default variant when the supplier only provides product-level stock and price", () => {
    const [product] = normalizeResellerPayload([{
      id: "digital-1",
      title: "Digital guide",
      supplier_price: 50,
      stock: 4,
    }]);

    assert.equal(product.variants[0].externalVariantId, "default");
    assert.equal(product.variants[0].stock, 4);
    assert.equal(product.variants[0].supplierPrice, "50.00");
  });

  it("rejects duplicate external product IDs", () => {
    assert.throws(
      () => normalizeResellerPayload([
        { id: "same", title: "One", supplier_price: 1 },
        { id: "same", title: "Two", supplier_price: 2 },
      ]),
      /duplicate product id same/,
    );
  });

  it("rejects images served over HTTP", () => {
    assert.throws(
      () => normalizeResellerPayload([{
        id: "product-1",
        title: "Product",
        supplier_price: 10,
        images: ["http://cdn.example/image.jpg"],
      }]),
      /Reseller image URL must use HTTPS/,
    );
  });
});
