"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/auth/authorization";
import type { ActionState } from "@/lib/actions/action-state";
import { getPrisma } from "@/lib/prisma";
import { encryptSecret, fingerprintSecret } from "@/lib/security/secrets";

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

const assetSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().trim(),
  type: z.enum(["DOWNLOAD", "LICENSE_KEY"]),
  label: z.string().trim().min(2).max(180),
  fileName: z.string().trim().max(255),
  downloadUrl: z.string().trim(),
  licenseKey: z.string().trim().max(4096),
});

export async function addDigitalAsset(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireStaff(["ADMIN", "MANAGER"]);
  const parsed = assetSchema.safeParse({
    productId: readFormString(formData, "productId"),
    variantId: readFormString(formData, "variantId"),
    type: readFormString(formData, "type"),
    label: readFormString(formData, "label"),
    fileName: readFormString(formData, "fileName"),
    downloadUrl: readFormString(formData, "downloadUrl"),
    licenseKey: readFormString(formData, "licenseKey"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Digital asset details are invalid." };
  }

  const input = parsed.data;
  const product = await getPrisma().product.findUnique({
    where: { id: input.productId },
    select: { id: true, type: true },
  });
  if (!product || product.type !== "DIGITAL") {
    return { error: "Choose an existing digital product." };
  }

  if (input.variantId) {
    const variant = await getPrisma().productVariant.findFirst({
      where: { id: input.variantId, productId: product.id },
      select: { id: true },
    });
    if (!variant) {
      return { error: "Choose a variant belonging to this digital product." };
    }
  }

  if (input.type === "DOWNLOAD") {
    if (!input.fileName || !input.downloadUrl || !isHttpsUrl(input.downloadUrl)) {
      return { error: "Provide a filename and an HTTPS URL for the downloadable file." };
    }

    await getPrisma().digitalAsset.create({
      data: {
        productId: product.id,
        variantId: input.variantId || null,
        type: "DOWNLOAD",
        label: input.label,
        fileName: input.fileName,
        downloadUrl: input.downloadUrl,
      },
    });
  } else {
    if (input.licenseKey.length < 8) {
      return { error: "License key must contain at least 8 characters." };
    }

    let encryptedValue: string;
    try {
      encryptedValue = encryptSecret(input.licenseKey);
    } catch (error) {
      return {
        error: error instanceof Error
          ? error.message
          : "Could not encrypt the license key.",
      };
    }

    const secretFingerprint = fingerprintSecret(input.licenseKey);
    const duplicate = await getPrisma().digitalAsset.findUnique({
      where: { secretFingerprint },
      select: { id: true },
    });
    if (duplicate) {
      return { error: "This license key is already stored." };
    }

    await getPrisma().digitalAsset.create({
      data: {
        productId: product.id,
        variantId: input.variantId || null,
        type: "LICENSE_KEY",
        label: input.label,
        encryptedValue,
        secretFingerprint,
      },
    });
  }

  revalidatePath("/admin/inventory/digital-products");
  return {
    success: input.type === "LICENSE_KEY"
      ? "License key encrypted and saved. Its value will not be shown again."
      : "Download reference saved. File delivery during checkout is not enabled in this phase.",
  };
}

export async function retireDigitalAsset(formData: FormData): Promise<void> {
  await requireStaff(["ADMIN", "MANAGER"]);
  const assetId = readFormString(formData, "assetId");
  if (!assetId) {
    throw new Error("Digital asset identifier is required.");
  }

  await getPrisma().digitalAsset.update({
    where: { id: assetId },
    data: { isAvailable: false },
  });
  revalidatePath("/admin/inventory/digital-products");
}
