-- CreateEnum
CREATE TYPE "DeliveryZone" AS ENUM ('DHAKA', 'CHATTOGRAM', 'REST_OF_BANGLADESH');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'AWAITING_PAYMENT', 'CONFIRMED', 'PROCESSING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('COD', 'BKASH', 'NAGAD', 'SSLCOMMERZ');

-- CreateEnum
CREATE TYPE "PaymentState" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "OfferDiscountType" AS ENUM ('FIXED', 'PERCENTAGE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StockAdjustmentType" ADD VALUE 'ORDER_RESERVED';
ALTER TYPE "StockAdjustmentType" ADD VALUE 'ORDER_RELEASED';

-- AlterTable
ALTER TABLE "general_settings" ADD COLUMN     "announcement_text" VARCHAR(240) NOT NULL DEFAULT 'Everything you need, at crazy speed.',
ADD COLUMN     "auto_move_to_pending" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "footer_message" TEXT NOT NULL DEFAULT 'আপনার প্রতিদিনের কেনাকাটার নির্ভরযোগ্য ঠিকানা।',
ADD COLUMN     "home_hero_description" TEXT NOT NULL DEFAULT 'Everything you need, at crazy speed.',
ADD COLUMN     "home_hero_title" VARCHAR(180) NOT NULL DEFAULT 'Crazy Cart',
ADD COLUMN     "next_order_sequence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "theme_accent_color" VARCHAR(7) NOT NULL DEFAULT '#a6edbb',
ADD COLUMN     "theme_primary_color" VARCHAR(7) NOT NULL DEFAULT '#176b48';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "allow_preorder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "shipping_class_id" TEXT,
ADD COLUMN     "size_guide" TEXT,
ADD COLUMN     "weight_grams" INTEGER NOT NULL DEFAULT 500;

-- AlterTable
ALTER TABLE "stock_adjustments" ALTER COLUMN "created_by_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "shipping_classes" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "surcharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_rates" (
    "id" TEXT NOT NULL,
    "zone" "DeliveryZone" NOT NULL,
    "base_charge" DECIMAL(12,2) NOT NULL,
    "included_weight_grams" INTEGER NOT NULL DEFAULT 1000,
    "extra_per_kg_charge" DECIMAL(12,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT NOT NULL,
    "promo_code" VARCHAR(60),
    "discount_type" "OfferDiscountType",
    "discount_value" DECIMAL(12,2),
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "show_popup" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_reviews" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "customer_name" VARCHAR(120) NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" VARCHAR(180),
    "body" TEXT NOT NULL,
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "order_number" VARCHAR(80) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "payment_method" "PaymentMethod" NOT NULL,
    "payment_state" "PaymentState" NOT NULL DEFAULT 'PENDING',
    "customer_name" VARCHAR(160) NOT NULL,
    "customer_phone" VARCHAR(40) NOT NULL,
    "customer_email" VARCHAR(254),
    "address" TEXT NOT NULL,
    "area" VARCHAR(120),
    "city" VARCHAR(120) NOT NULL,
    "delivery_zone" "DeliveryZone",
    "subtotal" DECIMAL(12,2) NOT NULL,
    "shipping_charge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "has_preorder" BOOLEAN NOT NULL DEFAULT false,
    "offer_id" TEXT,
    "applied_promo_code" VARCHAR(60),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "product_name" VARCHAR(180) NOT NULL,
    "sku" VARCHAR(120) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "line_total" DECIMAL(12,2) NOT NULL,
    "weight_grams" INTEGER NOT NULL,
    "is_preorder" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_batches" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "order_item_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_item_digital_assets" (
    "id" TEXT NOT NULL,
    "order_item_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_item_digital_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "state" "PaymentState" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(12,2) NOT NULL,
    "provider_ref" VARCHAR(160),
    "idempotency_key" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipping_classes_code_key" ON "shipping_classes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_rates_zone_key" ON "delivery_rates"("zone");

-- CreateIndex
CREATE UNIQUE INDEX "offers_promo_code_key" ON "offers"("promo_code");

-- CreateIndex
CREATE INDEX "offers_is_active_starts_at_ends_at_idx" ON "offers"("is_active", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "product_reviews_product_id_is_approved_created_at_idx" ON "product_reviews"("product_id", "is_approved", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "orders_customer_phone_created_at_idx" ON "orders"("customer_phone", "created_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_item_batches_order_item_id_batch_id_key" ON "order_item_batches"("order_item_id", "batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_item_digital_assets_asset_id_key" ON "order_item_digital_assets"("asset_id");

-- CreateIndex
CREATE INDEX "order_item_digital_assets_order_item_id_idx" ON "order_item_digital_assets"("order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_idempotency_key_key" ON "payment_attempts"("idempotency_key");

-- CreateIndex
CREATE INDEX "payment_attempts_order_id_created_at_idx" ON "payment_attempts"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "products_shipping_class_id_idx" ON "products"("shipping_class_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_shipping_class_id_fkey" FOREIGN KEY ("shipping_class_id") REFERENCES "shipping_classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_batches" ADD CONSTRAINT "order_item_batches_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_batches" ADD CONSTRAINT "order_item_batches_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_digital_assets" ADD CONSTRAINT "order_item_digital_assets_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_item_digital_assets" ADD CONSTRAINT "order_item_digital_assets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "digital_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add checkout and catalog invariants.
ALTER TABLE "general_settings"
ADD CONSTRAINT "general_settings_next_order_sequence_check" CHECK ("next_order_sequence" >= 0);

ALTER TABLE "products"
ADD CONSTRAINT "products_weight_grams_check" CHECK ("weight_grams" >= 0);

ALTER TABLE "shipping_classes"
ADD CONSTRAINT "shipping_classes_surcharge_check" CHECK ("surcharge" >= 0);

ALTER TABLE "delivery_rates"
ADD CONSTRAINT "delivery_rates_amounts_and_weight_check"
CHECK ("base_charge" >= 0 AND "extra_per_kg_charge" >= 0 AND "included_weight_grams" > 0);

ALTER TABLE "offers"
ADD CONSTRAINT "offers_discount_check"
CHECK (
  ("discount_type" IS NULL AND "discount_value" IS NULL)
  OR ("discount_type" = 'FIXED' AND "discount_value" IS NOT NULL AND "discount_value" >= 0)
  OR ("discount_type" = 'PERCENTAGE' AND "discount_value" IS NOT NULL AND "discount_value" BETWEEN 0 AND 100)
);

ALTER TABLE "product_reviews"
ADD CONSTRAINT "product_reviews_rating_check" CHECK ("rating" BETWEEN 1 AND 5);

ALTER TABLE "orders"
ADD CONSTRAINT "orders_amounts_check"
CHECK (
  "subtotal" >= 0
  AND "shipping_charge" >= 0
  AND "discount_amount" BETWEEN 0 AND "subtotal"
  AND "total" = "subtotal" + "shipping_charge" - "discount_amount"
);

ALTER TABLE "order_items"
ADD CONSTRAINT "order_items_quantity_check"
CHECK (
  "quantity" > 0
  AND "reserved_quantity" BETWEEN 0 AND "quantity"
  AND "unit_price" >= 0
  AND "line_total" = "unit_price" * "quantity"
  AND "weight_grams" >= 0
);

ALTER TABLE "order_item_batches"
ADD CONSTRAINT "order_item_batches_quantity_check" CHECK ("quantity" > 0);

ALTER TABLE "payment_attempts"
ADD CONSTRAINT "payment_attempts_amount_check" CHECK ("amount" >= 0);
