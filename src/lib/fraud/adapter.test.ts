import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HistoryOnlyFraudAdapter } from "./adapter";

describe("HistoryOnlyFraudAdapter", () => {
  it("reports history facts without presenting them as an external fraud verdict", async () => {
    const result = await new HistoryOnlyFraudAdapter().checkCustomer({
      customerPhone: "01611179008",
      orders: [
        { status: "DELIVERED", total: "500.00", createdAt: new Date("2026-01-01") },
        { status: "RETURNED", total: "250.00", createdAt: new Date("2026-02-01") },
      ],
    });
    assert.equal(result.riskLevel, "UNKNOWN");
    assert.match(result.summary, /1 delivered, 1 returned/);
    assert.match(result.summary, /not a fraud verdict/);
  });
});
