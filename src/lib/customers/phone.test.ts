import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeCustomerPhone } from "./phone";

describe("normalizeCustomerPhone", () => {
  it("normalizes Bangladesh country-code formats to a local digits-only key", () => {
    assert.equal(normalizeCustomerPhone("+880 1611-179008"), "01611179008");
    assert.equal(normalizeCustomerPhone("00880 1611 179008"), "01611179008");
    assert.equal(normalizeCustomerPhone("01611-179008"), "01611179008");
    assert.equal(normalizeCustomerPhone(""), null);
  });
});
