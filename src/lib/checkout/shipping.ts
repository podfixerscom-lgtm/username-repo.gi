export type ShippingLine = {
  productType: "PHYSICAL" | "DIGITAL";
  quantity: number;
  weightGrams: number;
  shippingClassId: string | null;
  shippingSurcharge: string | number | null;
};

export type DeliveryRateInput = {
  baseCharge: string | number;
  includedWeightGrams: number;
  extraPerKgCharge: string | number;
};

export interface DeliveryCalculationInput {
  subtotalBDT: number;
  baseDeliveryChargeBDT: number;
  weightKg?: number;
  perExtraKgChargeBDT?: number;
  freeDeliveryAboveBDT?: number | null;
  includedWeightKg?: number;
}

function toCents(amount: string | number): number {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Shipping amounts must be finite and non-negative.");
  }
  const cents = Math.round(parsed * 100);
  if (!Number.isSafeInteger(cents)) {
    throw new Error("Shipping amount exceeds the supported range.");
  }
  return cents;
}

export function calculateDeliveryChargeBDT({
  subtotalBDT,
  baseDeliveryChargeBDT,
  weightKg = 0.5,
  perExtraKgChargeBDT = 0,
  freeDeliveryAboveBDT = null,
  includedWeightKg = 1,
}: DeliveryCalculationInput): number {
  if (!Number.isFinite(subtotalBDT) || subtotalBDT < 0) {
    throw new Error("Order subtotal must be finite and non-negative.");
  }
  if (!Number.isFinite(weightKg) || weightKg < 0) {
    throw new Error("Shipment weight must be finite and non-negative.");
  }
  if (!Number.isFinite(includedWeightKg) || includedWeightKg <= 0) {
    throw new Error("Included shipping weight must be finite and positive.");
  }
  if (freeDeliveryAboveBDT !== null &&
      (!Number.isFinite(freeDeliveryAboveBDT) || freeDeliveryAboveBDT < 0)) {
    throw new Error("Free delivery threshold must be finite and non-negative.");
  }
  const baseChargeCents = toCents(baseDeliveryChargeBDT);
  const extraChargeCents = toCents(perExtraKgChargeBDT);
  if (freeDeliveryAboveBDT !== null && subtotalBDT >= freeDeliveryAboveBDT) {
    return 0;
  }

  const extraKg = Math.ceil(Math.max(0, weightKg - includedWeightKg));
  const totalCents = baseChargeCents + extraKg * extraChargeCents;
  if (!Number.isSafeInteger(totalCents)) {
    throw new Error("Calculated delivery charge exceeds the supported range.");
  }
  return totalCents / 100;
}

export function calculateShippingCharge(
  lines: readonly ShippingLine[],
  rate: DeliveryRateInput,
  subtotalBDT = 0,
  freeDeliveryAboveBDT: number | null = null,
): number {
  if (!Number.isSafeInteger(rate.includedWeightGrams) || rate.includedWeightGrams <= 0) {
    throw new Error("Included shipping weight must be a positive whole number.");
  }

  const physicalLines = lines.filter((line) => line.productType === "PHYSICAL");
  if (physicalLines.length === 0) {
    return 0;
  }

  let totalWeightGrams = 0;
  let classSurchargeCents = 0;
  const chargedClasses = new Set<string>();

  for (const line of physicalLines) {
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new Error("Shipping line quantity must be a positive whole number.");
    }
    if (!Number.isSafeInteger(line.weightGrams) || line.weightGrams < 0) {
      throw new Error("Product weight must be a non-negative whole number.");
    }

    totalWeightGrams += line.quantity * line.weightGrams;
    if (!Number.isSafeInteger(totalWeightGrams)) {
      throw new Error("Shipment weight exceeds the supported range.");
    }

    if (line.shippingClassId && !chargedClasses.has(line.shippingClassId)) {
      classSurchargeCents += toCents(line.shippingSurcharge ?? 0);
      chargedClasses.add(line.shippingClassId);
    }
  }

  const baseAndClassCharge = toCents(rate.baseCharge) + classSurchargeCents;
  if (!Number.isSafeInteger(baseAndClassCharge)) {
    throw new Error("Calculated delivery charge exceeds the supported range.");
  }
  return calculateDeliveryChargeBDT({
    subtotalBDT,
    baseDeliveryChargeBDT: baseAndClassCharge / 100,
    weightKg: totalWeightGrams / 1000,
    perExtraKgChargeBDT: toCents(rate.extraPerKgCharge) / 100,
    includedWeightKg: rate.includedWeightGrams / 1000,
    freeDeliveryAboveBDT,
  });
}

export function calculateOfferDiscount(
  subtotal: number,
  discountType: "FIXED" | "PERCENTAGE",
  discountValue: string | number,
): number {
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw new Error("Order subtotal must be finite and non-negative.");
  }
  const subtotalCents = toCents(subtotal);
  const value = Number(discountValue);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Offer discount must be finite and non-negative.");
  }
  if (discountType === "PERCENTAGE" && value > 100) {
    throw new Error("Percentage discount cannot exceed 100.");
  }
  const discountCents = discountType === "PERCENTAGE"
    ? Math.round(subtotalCents * value / 100)
    : toCents(value);
  return Math.min(subtotalCents, discountCents) / 100;
}
