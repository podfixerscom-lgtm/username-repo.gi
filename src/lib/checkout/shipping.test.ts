import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatOrderNumber } from "./order-number";
import {
  calculateDeliveryChargeBDT,
  calculateOfferDiscount,
  calculateShippingCharge,
} from "./shipping";

describe("calculateShippingCharge", () => {
  const rate = {
    baseCharge: "70.00",
    includedWeightGrams: 1000,
    extraPerKgCharge: "20.00",
  };

  it("adds a class surcharge once per package and charges each started extra kilogram", () => {
    assert.equal(
      calculateShippingCharge([
        {
          productType: "PHYSICAL",
          quantity: 2,
          weightGrams: 900,
          shippingClassId: "standard",
          shippingSurcharge: "100.00",
        },
        {
          productType: "PHYSICAL",
          quantity: 1,
          weightGrams: 500,
          shippingClassId: "standard",
          shippingSurcharge: "100.00",
        },
      ], rate),
      210,
    );
  });

  it("does not charge shipping for digital-only carts", () => {
    assert.equal(
      calculateShippingCharge([{
        productType: "DIGITAL",
        quantity: 1,
        weightGrams: 0,
        shippingClassId: null,
        shippingSurcharge: null,
      }], rate),
      0,
    );
  });

  it("waives all delivery charges at the configured subtotal threshold", () => {
    const physicalLine = [{
      productType: "PHYSICAL" as const,
      quantity: 1,
      weightGrams: 1500,
      shippingClassId: "oversized",
      shippingSurcharge: "30.00",
    }];
    assert.equal(calculateShippingCharge(physicalLine, rate, 500, 500), 0);
    assert.equal(calculateShippingCharge(physicalLine, rate, 499.99, 500), 120);
  });

  it("applies the threshold inclusively and preserves per-started-kilogram charges", () => {
    assert.equal(calculateDeliveryChargeBDT({
      subtotalBDT: 500,
      baseDeliveryChargeBDT: 70,
      weightKg: 2.01,
      perExtraKgChargeBDT: 20,
      freeDeliveryAboveBDT: 500,
    }), 0);
    assert.equal(calculateDeliveryChargeBDT({
      subtotalBDT: 499.99,
      baseDeliveryChargeBDT: 70,
      weightKg: 2.01,
      perExtraKgChargeBDT: 20,
      freeDeliveryAboveBDT: 500,
    }), 110);
  });
});

describe("formatOrderNumber", () => {
  it("keeps the existing prefix and six-digit sequence format", () => {
    assert.equal(formatOrderNumber(" 1001 ", 1), "1001-000001");
    assert.equal(formatOrderNumber("CC", 1234567), "CC-1234567");
  });

  it("rejects empty prefixes and invalid sequences", () => {
    assert.throws(() => formatOrderNumber(" ", 1));
    assert.throws(() => formatOrderNumber("1001", 0));
    assert.throws(() => formatOrderNumber("1001", 1.5));
  });
});

describe("calculateOfferDiscount", () => {
  it("caps fixed discounts and accepts a 100 percent offer", () => {
    assert.equal(calculateOfferDiscount(100, "FIXED", 150), 100);
    assert.equal(calculateOfferDiscount(100, "PERCENTAGE", 100), 100);
  });
});
