export function normalizeCustomerPhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 40) return null;

  if (digits.startsWith("00880")) return `0${digits.slice(5)}`;
  if (digits.startsWith("880")) return `0${digits.slice(3)}`;
  return digits;
}
