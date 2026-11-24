export function formatOrderNumber(prefix: string, sequenceNumber: number): string {
  const cleanPrefix = prefix.trim();
  if (!cleanPrefix) {
    throw new Error("Order number prefix cannot be empty.");
  }
  if (!Number.isSafeInteger(sequenceNumber) || sequenceNumber <= 0) {
    throw new Error("Order sequence number must be a positive whole number.");
  }
  return `${cleanPrefix}-${String(sequenceNumber).padStart(6, "0")}`;
}
