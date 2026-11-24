"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/auth/authorization";
import type { ActionState } from "@/lib/actions/action-state";
import { encryptSecret } from "@/lib/security/secrets";
import { assertPublicHttpsUrl } from "@/lib/resellers/safe-url";
import { getPrisma } from "@/lib/prisma";
import {
  syncResellerSource,
  testResellerConnection,
} from "@/lib/resellers/sync";

const moneyField = z.string()
  .trim()
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/, "Enter a non-negative amount with up to 2 decimal places.")
  .transform(Number)
  .refine((value) => Number.isFinite(value) && value <= 9_999_999_999.99);

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The reseller request failed unexpectedly.";
}

const sourceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  baseUrl: z.string().trim().url().max(2048),
  authType: z.enum(["API_KEY", "BEARER"]),
  apiKey: z.string().trim().min(8).max(4096),
  markupType: z.enum(["FIXED", "PERCENTAGE"]),
  markupValue: moneyField,
});

export async function createResellerSource(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = sourceSchema.safeParse({
    name: readFormString(formData, "name"),
    baseUrl: readFormString(formData, "baseUrl"),
    authType: readFormString(formData, "authType"),
    apiKey: readFormString(formData, "apiKey"),
    markupType: readFormString(formData, "markupType"),
    markupValue: readFormString(formData, "markupValue"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Reseller source details are invalid." };
  }

  const input = parsed.data;
  if (input.markupType === "PERCENTAGE" && input.markupValue > 1000) {
    return { error: "Percentage markup cannot exceed 1000%." };
  }

  try {
    await assertPublicHttpsUrl(input.baseUrl);
  } catch (error) {
    return { error: errorMessage(error) };
  }

  const prisma = getPrisma();
  const duplicate = await prisma.resellerSource.findUnique({
    where: { name: input.name },
    select: { id: true },
  });
  if (duplicate) {
    return { error: "A reseller source with this name already exists." };
  }

  let encryptedApiKey: string;
  try {
    encryptedApiKey = encryptSecret(input.apiKey);
  } catch (error) {
    return { error: errorMessage(error) };
  }

  await prisma.resellerSource.create({
    data: {
      name: input.name,
      baseUrl: input.baseUrl,
      authType: input.authType,
      encryptedApiKey,
      markupType: input.markupType,
      markupValue: input.markupValue.toFixed(2),
    },
  });

  revalidatePath("/admin/inventory/import");
  return { success: "Reseller source saved. The API key is encrypted and will not be shown again." };
}

const updateSourceSchema = z.object({
  sourceId: z.string().min(1),
  name: z.string().trim().min(2).max(120),
  baseUrl: z.string().trim().url().max(2048),
  authType: z.enum(["API_KEY", "BEARER"]),
  apiKey: z.string().trim().max(4096),
  markupType: z.enum(["FIXED", "PERCENTAGE"]),
  markupValue: moneyField,
  isActive: z.boolean(),
});

export async function updateResellerSource(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = updateSourceSchema.safeParse({
    sourceId: readFormString(formData, "sourceId"),
    name: readFormString(formData, "name"),
    baseUrl: readFormString(formData, "baseUrl"),
    authType: readFormString(formData, "authType"),
    apiKey: readFormString(formData, "apiKey"),
    markupType: readFormString(formData, "markupType"),
    markupValue: readFormString(formData, "markupValue"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Reseller source details are invalid." };
  }

  const input = parsed.data;
  if (input.markupType === "PERCENTAGE" && input.markupValue > 1000) {
    return { error: "Percentage markup cannot exceed 1000%." };
  }

  try {
    await assertPublicHttpsUrl(input.baseUrl);
  } catch (error) {
    return { error: errorMessage(error) };
  }

  const prisma = getPrisma();
  const source = await prisma.resellerSource.findUnique({
    where: { id: input.sourceId },
    select: { id: true, name: true, authType: true },
  });
  if (!source) {
    return { error: "Reseller source was not found." };
  }

  const duplicate = await prisma.resellerSource.findFirst({
    where: { name: input.name, id: { not: source.id } },
    select: { id: true },
  });
  if (duplicate) {
    return { error: "A reseller source with this name already exists." };
  }
  if (source.authType !== input.authType && !input.apiKey) {
    return { error: "Enter a new API key when changing the authentication type." };
  }

  let encryptedApiKey: string | undefined;
  if (input.apiKey) {
    try {
      encryptedApiKey = encryptSecret(input.apiKey);
    } catch (error) {
      return { error: errorMessage(error) };
    }
  }

  await prisma.resellerSource.update({
    where: { id: source.id },
    data: {
      name: input.name,
      baseUrl: input.baseUrl,
      authType: input.authType,
      encryptedApiKey,
      markupType: input.markupType,
      markupValue: input.markupValue.toFixed(2),
      isActive: input.isActive,
    },
  });

  revalidatePath("/admin/inventory/import");
  return { success: "Reseller source settings saved." };
}

const sourceIdSchema = z.string().min(1);

export async function testConnection(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = sourceIdSchema.safeParse(readFormString(formData, "sourceId"));
  if (!parsed.success) {
    return { error: "Choose a reseller source to test." };
  }

  try {
    const result = await testResellerConnection(parsed.data);
    return { success: `Connection successful. The catalog endpoint returned ${result.productsFound} product(s).` };
  } catch (error) {
    return { error: `Connection test failed: ${errorMessage(error)}` };
  }
}

export async function syncNow(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = sourceIdSchema.safeParse(readFormString(formData, "sourceId"));
  if (!parsed.success) {
    return { error: "Choose a reseller source to synchronize." };
  }

  try {
    const result = await syncResellerSource(parsed.data, user.id);
    revalidatePath("/admin/inventory/products");
    revalidatePath("/admin/inventory/digital-products");
    revalidatePath("/admin/inventory/import");
    return {
      success: `Sync complete: ${result.productsCreated} added, ${result.productsUpdated} updated, ${result.variantsCreated} new variants; ${result.stockUnitsChanged} net stock units changed.`,
    };
  } catch (error) {
    return { error: `Sync failed: ${errorMessage(error)}` };
  }
}
