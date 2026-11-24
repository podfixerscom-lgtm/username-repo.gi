import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { recoverStaleSyncs, type OfflineSale } from "./offline-queue";

const sale: OfflineSale = {
  idempotencyKey: "test-key",
  source: "POS",
  customerName: "",
  customerPhone: "",
  lines: [{ variantId: "variant-1", quantity: 1 }],
  createdAt: "2026-01-01T00:00:00.000Z",
  state: "SYNCING",
  syncStartedAt: "2026-01-01T00:00:00.000Z",
};

describe("recoverStaleSyncs", () => {
  it("keeps a recent sync in progress", () => {
    const now = Date.parse("2026-01-01T00:01:00.000Z");
    assert.equal(recoverStaleSyncs([sale], now)[0].state, "SYNCING");
  });

  it("queues interrupted syncs for safe idempotent retry", () => {
    const recovered = recoverStaleSyncs([sale], Date.parse("2026-01-01T00:06:00.000Z"))[0];
    assert.equal(recovered.state, "QUEUED");
    assert.equal(recovered.syncStartedAt, undefined);
    assert.match(recovered.error ?? "", /Retrying is safe/);
  });

  it("recovers older queue records without a sync timestamp", () => {
    const recovered = recoverStaleSyncs([{ ...sale, syncStartedAt: undefined }])[0];
    assert.equal(recovered.state, "QUEUED");
  });
});
