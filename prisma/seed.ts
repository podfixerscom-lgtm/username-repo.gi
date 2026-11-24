import { hash } from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  AccountingCategoryType,
  DeliveryZone,
  PrismaClient,
  UserRole,
} from "../src/generated/prisma/client";
import { z } from "zod";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function main() {
  await prisma.generalSettings.upsert({
    where: { id: "store" },
    update: {},
    create: {
      id: "store",
      storeName: process.env.STORE_NAME?.trim() || "Crazy Cart",
      tagline:
        process.env.STORE_TAGLINE?.trim() ||
        "Everything you need, at crazy speed.",
      orderNumberPrefix:
        process.env.ORDER_NUMBER_PREFIX?.trim() || "1001",
      currencyCode: "BDT",
      currencySymbol: "৳",
      contactEmail: process.env.STORE_CONTACT_EMAIL?.trim() || null,
      contactPhone: process.env.STORE_CONTACT_PHONE?.trim() || "01611179008",
      contactAddress:
        process.env.STORE_CONTACT_ADDRESS?.trim() || "Halishahar, Chittagong",
    },
  });

  await prisma.generalSettings.updateMany({
    where: { contactPhone: null },
    data: {
      contactPhone: process.env.STORE_CONTACT_PHONE?.trim() || "01611179008",
    },
  });
  await prisma.generalSettings.updateMany({
    where: { contactAddress: null },
    data: {
      contactAddress:
        process.env.STORE_CONTACT_ADDRESS?.trim() || "Halishahar, Chittagong",
    },
  });

  await prisma.warehouse.upsert({
    where: { code: "MAIN" },
    update: {},
    create: {
      name: "Main Warehouse",
      code: "MAIN",
    },
  });

  const accountingCategories = [
    { name: "Other income", type: AccountingCategoryType.INCOME },
    { name: "Courier COD remittance", type: AccountingCategoryType.INCOME },
    { name: "Operating expenses", type: AccountingCategoryType.EXPENSE },
    { name: "Courier fees", type: AccountingCategoryType.EXPENSE },
    { name: "Payroll", type: AccountingCategoryType.EXPENSE },
  ];
  for (const category of accountingCategories) {
    await prisma.accountingCategory.upsert({
      where: { name_type: category },
      update: {},
      create: category,
    });
  }

  await prisma.shippingClass.upsert({
    where: { code: "STANDARD" },
    update: {},
    create: {
      code: "STANDARD",
      name: "Standard",
      surcharge: "100.00",
    },
  });

  const deliveryRates = [
    { zone: DeliveryZone.DHAKA, baseCharge: "70.00" },
    { zone: DeliveryZone.CHATTOGRAM, baseCharge: "90.00" },
    { zone: DeliveryZone.REST_OF_BANGLADESH, baseCharge: "130.00" },
  ];
  for (const rate of deliveryRates) {
    await prisma.deliveryRate.upsert({
      where: { zone: rate.zone },
      update: {},
      create: {
        ...rate,
        includedWeightGrams: 1000,
        extraPerKgCharge: "20.00",
      },
    });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() || null;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || null;

  if (Boolean(adminEmail) !== Boolean(adminPassword)) {
    throw new Error(
      "Set both SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD to create the initial admin.",
    );
  }

  if (!adminEmail || !adminPassword) {
    console.info("Store settings seeded; no admin account was requested.");
    return;
  }

  if (!z.email().safeParse(adminEmail).success) {
    throw new Error("SEED_ADMIN_EMAIL must be a valid email address.");
  }

  if (adminPassword.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD must contain at least 12 characters.");
  }

  const passwordHash = await hash(adminPassword, 12);
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  });

  if (existingAdmin) {
    console.info("Store settings seeded; the existing account was left unchanged.");
    return;
  }

  await prisma.user.create({
    data: {
      name: "Crazy Cart Admin",
      email: adminEmail,
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  console.info("Store settings and initial admin account seeded.");
}

main()
  .catch((error: unknown) => {
    console.error("Database seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
