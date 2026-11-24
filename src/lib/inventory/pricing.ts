import { Prisma } from "@/generated/prisma/client";
import type { MarkupType as DatabaseMarkupType } from "@/generated/prisma/client";

const MAX_PRICE = new Prisma.Decimal("9999999999.99");

export type ResellerMarkupType = "Percentage" | "Fixed BDT";

export function calculateResellerSellingPriceBDT(
  supplierPriceBDT: string | number,
  markupType: ResellerMarkupType,
  markupValue: string | number,
): string {
  const cost = new Prisma.Decimal(supplierPriceBDT);
  const markup = new Prisma.Decimal(markupValue);

  if (!cost.isFinite() || !markup.isFinite()) {
    throw new Error("Supplier price and markup must be finite numbers.");
  }
  if (cost.isNegative() || markup.isNegative()) {
    throw new Error("Supplier price and markup must not be negative.");
  }

  const retailPrice = markupType === "Percentage"
    ? cost.mul(new Prisma.Decimal(1).plus(markup.div(100)))
    : cost.plus(markup);

  if (retailPrice.greaterThan(MAX_PRICE)) {
    throw new Error("Calculated retail price exceeds the supported BDT range.");
  }

  return retailPrice.toDecimalPlaces(2).toFixed(2);
}

export function calculateRetailPrice(
  supplierPriceBDT: string | number,
  markupType: DatabaseMarkupType,
  markupValue: string | number,
): string {
  const resellerMarkupType: ResellerMarkupType =
    markupType === "PERCENTAGE" ? "Percentage" : "Fixed BDT";

  return calculateResellerSellingPriceBDT(
    supplierPriceBDT,
    resellerMarkupType,
    markupValue,
  );
}
