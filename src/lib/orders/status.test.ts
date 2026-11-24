import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAllowedOrderStatusTransitions } from "./status";

describe("getAllowedOrderStatusTransitions", () => {
  it("allows packing progression and makes terminal states immutable", () => {
    assert.deepEqual(getAllowedOrderStatusTransitions("PROCESSING"), ["PACKED", "CANCELLED"]);
    assert.deepEqual(getAllowedOrderStatusTransitions("SHIPPED"), ["DELIVERED", "RETURNED"]);
    assert.deepEqual(getAllowedOrderStatusTransitions("CANCELLED"), []);
    assert.deepEqual(getAllowedOrderStatusTransitions("RETURNED"), []);
  });
});
