import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "../../generated/prisma/client";
import { planFifoConsumption } from "./fifo";
import {
  calculateResellerSellingPriceBDT,
  calculateRetailPrice,
} from "./pricing";

describe("calculateRetailPrice", () => {
  it("adds a fixed BDT markup", () => {
    assert.equal(calculateRetailPrice("125.50", "FIXED", "10"), "135.50");
  });

  it("applies percentage markup and rounds to two decimal places", () => {
    assert.equal(calculateRetailPrice("125.50", "PERCENTAGE", "10"), "138.05");
    assert.equal(calculateRetailPrice("0.05", "PERCENTAGE", "10"), "0.06");
  });

  it("rejects negative supplier prices or markups", () => {
    assert.throws(() => calculateRetailPrice("-1", "FIXED", "0"));
    assert.throws(() => calculateRetailPrice("1", "FIXED", "-1"));
  });

  it("supports the explicit reseller markup labels with decimal-safe rounding", () => {
    assert.equal(
      calculateResellerSellingPriceBDT("125.50", "Percentage", "10"),
      "138.05",
    );
    assert.equal(
      calculateResellerSellingPriceBDT("125.50", "Fixed BDT", "10"),
      "135.50",
    );
    assert.equal(
      calculateResellerSellingPriceBDT("1.005", "Fixed BDT", 0),
      "1.01",
    );
  });

  it("rejects non-finite reseller price inputs instead of silently treating them as zero", () => {
    assert.throws(() => calculateResellerSellingPriceBDT(Number.NaN, "Fixed BDT", 0));
    assert.throws(() => calculateResellerSellingPriceBDT(10, "Percentage", Number.POSITIVE_INFINITY));
  });
});

describe("planFifoConsumption", () => {
  const receivedAt = new Date("2026-01-01T00:00:00.000Z");
  const batches = [
    {
      id: "newer",
      quantityRemaining: 8,
      unitCost: new Prisma.Decimal("12.00"),
      receivedAt: new Date("2026-01-02T00:00:00.000Z"),
    },
    {
      id: "older",
      quantityRemaining: 3,
      unitCost: new Prisma.Decimal("10.00"),
      receivedAt,
    },
  ];

  it("consumes the oldest batch first, then the next batch", () => {
    const allocations = planFifoConsumption(batches, 5);

    assert.deepEqual(
      allocations.map(({ batchId, quantity }) => ({ batchId, quantity })),
      [
        { batchId: "older", quantity: 3 },
        { batchId: "newer", quantity: 2 },
      ],
    );
  });

  it("rejects requests exceeding remaining batch stock", () => {
    assert.throws(() => planFifoConsumption(batches, 12), /Insufficient FIFO stock/);
  });
});
