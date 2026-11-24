import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMetaConversionEvent } from "./server";

describe("createMetaConversionEvent", () => {
  it("does not produce a CAPI event without marketing consent", () => {
    assert.equal(createMetaConversionEvent({
      eventName: "Purchase",
      eventSourceUrl: "https://crazycart.example/thank-you",
    }, false), null);
  });

  it("creates a PII-free consented event payload", () => {
    const event = createMetaConversionEvent({
      eventName: "Purchase",
      eventSourceUrl: "https://crazycart.example/thank-you",
      eventId: "order-event-1",
      currency: "BDT",
      value: 250,
      contentIds: ["product-1"],
    }, true);

    assert.equal(event?.event_name, "Purchase");
    assert.equal(event?.event_id, "order-event-1");
    assert.deepEqual(event?.custom_data, {
      currency: "BDT",
      value: 250,
      content_ids: ["product-1"],
    });
    assert.equal("user_data" in (event ?? {}), false);
  });

  it("rejects insecure event source URLs and invalid values", () => {
    assert.throws(() => createMetaConversionEvent({
      eventName: "ViewContent",
      eventSourceUrl: "http://example.com/product",
    }, true), /HTTPS/);
    assert.throws(() => createMetaConversionEvent({
      eventName: "Purchase",
      eventSourceUrl: "https://example.com/thank-you",
      value: -1,
    }, true), /non-negative/);
  });
});
