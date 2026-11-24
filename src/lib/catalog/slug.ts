import { randomUUID } from "node:crypto";

export function slugify(value: string): string {
  const slug = value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");

  return slug || `item-${randomUUID().slice(0, 8)}`;
}
