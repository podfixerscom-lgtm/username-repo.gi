-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "ResellerAuthType" AS ENUM ('API_KEY', 'BEARER');

-- CreateEnum
CREATE TYPE "MarkupType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('PHYSICAL', 'DIGITAL');

-- CreateEnum
CREATE TYPE "DigitalAssetType" AS ENUM ('DOWNLOAD', 'LICENSE_KEY');

-- CreateEnum
CREATE TYPE "StockAdjustmentType" AS ENUM ('OPENING', 'RECEIVE', 'DAMAGE', 'LOSS', 'RETURN', 'CORRECTION', 'RESELLER_SYNC', 'TRANSFER_IN', 'TRANSFER_OUT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "general_settings" (
    "id" TEXT NOT NULL DEFAULT 'store',
    "store_name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "order_number_prefix" TEXT NOT NULL DEFAULT '1001',
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "currency_symbol" TEXT NOT NULL DEFAULT '৳',
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "contact_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "general_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reseller_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_url" VARCHAR(2048) NOT NULL,
    "auth_type" "ResellerAuthType" NOT NULL,
    "encrypted_api_key" TEXT NOT NULL,
    "markup_type" "MarkupType" NOT NULL DEFAULT 'FIXED',
    "markup_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "last_synced_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reseller_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "parent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "type" "ProductType" NOT NULL DEFAULT 'PHYSICAL',
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'BDT',
    "category_id" TEXT,
    "brand_id" TEXT,
    "external_source_id" TEXT,
    "external_product_id" TEXT,
    "supplier_price" DECIMAL(12,2),
    "is_reseller_product" BOOLEAN NOT NULL DEFAULT false,
    "last_reseller_synced_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" VARCHAR(120),
    "sku" VARCHAR(120) NOT NULL,
    "external_sku" VARCHAR(120),
    "size" VARCHAR(80),
    "color" VARCHAR(80),
    "price" DECIMAL(12,2) NOT NULL,
    "stock_on_hand" INTEGER NOT NULL DEFAULT 0,
    "external_variant_id" VARCHAR(180),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "external_source_id" TEXT,
    "url" VARCHAR(2048) NOT NULL,
    "alt_text" VARCHAR(250) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digital_assets" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT,
    "type" "DigitalAssetType" NOT NULL,
    "label" VARCHAR(180) NOT NULL,
    "file_name" VARCHAR(255),
    "download_url" VARCHAR(2048),
    "encrypted_value" TEXT,
    "secret_fingerprint" VARCHAR(64),
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "digital_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_batches" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "batch_code" VARCHAR(120),
    "quantity_received" INTEGER NOT NULL,
    "quantity_remaining" INTEGER NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_adjustments" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "type" "StockAdjustmentType" NOT NULL,
    "quantity_change" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "from_warehouse_id" TEXT NOT NULL,
    "to_warehouse_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_batches" (
    "id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "source_batch_id" TEXT NOT NULL,
    "destination_batch_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "stock_transfer_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_is_active_idx" ON "users"("role", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "reseller_sources_name_key" ON "reseller_sources"("name");

-- CreateIndex
CREATE INDEX "reseller_sources_is_active_idx" ON "reseller_sources"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "brands_name_key" ON "brands"("name");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");

-- CreateIndex
CREATE INDEX "products_is_reseller_product_is_active_idx" ON "products"("is_reseller_product", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "products_external_source_id_external_product_id_key" ON "products"("external_source_id", "external_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "product_variants_product_id_is_active_idx" ON "product_variants"("product_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_product_id_external_variant_id_key" ON "product_variants"("product_id", "external_variant_id");

-- CreateIndex
CREATE INDEX "product_images_external_source_id_idx" ON "product_images"("external_source_id");

-- CreateIndex
CREATE INDEX "product_images_product_id_sort_order_idx" ON "product_images"("product_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "product_images_product_id_url_key" ON "product_images"("product_id", "url");

-- CreateIndex
CREATE UNIQUE INDEX "digital_assets_secret_fingerprint_key" ON "digital_assets"("secret_fingerprint");

-- CreateIndex
CREATE INDEX "digital_assets_product_id_type_is_available_idx" ON "digital_assets"("product_id", "type", "is_available");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_name_key" ON "warehouses"("name");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE INDEX "inventory_batches_variant_id_warehouse_id_received_at_id_idx" ON "inventory_batches"("variant_id", "warehouse_id", "received_at", "id");

-- CreateIndex
CREATE INDEX "stock_adjustments_variant_id_created_at_idx" ON "stock_adjustments"("variant_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_adjustments_warehouse_id_created_at_idx" ON "stock_adjustments"("warehouse_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_transfers_variant_id_created_at_idx" ON "stock_transfers"("variant_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfer_batches_transfer_id_source_batch_id_destinat_key" ON "stock_transfer_batches"("transfer_id", "source_batch_id", "destination_batch_id");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_external_source_id_fkey" FOREIGN KEY ("external_source_id") REFERENCES "reseller_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_external_source_id_fkey" FOREIGN KEY ("external_source_id") REFERENCES "reseller_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_assets" ADD CONSTRAINT "digital_assets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_assets" ADD CONSTRAINT "digital_assets_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_warehouse_id_fkey" FOREIGN KEY ("from_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_warehouse_id_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_batches" ADD CONSTRAINT "stock_transfer_batches_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_batches" ADD CONSTRAINT "stock_transfer_batches_source_batch_id_fkey" FOREIGN KEY ("source_batch_id") REFERENCES "inventory_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_batches" ADD CONSTRAINT "stock_transfer_batches_destination_batch_id_fkey" FOREIGN KEY ("destination_batch_id") REFERENCES "inventory_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep monetary and inventory invariants valid even for direct SQL writes.
ALTER TABLE "reseller_sources"
    ADD CONSTRAINT "reseller_sources_markup_value_check"
    CHECK ("markup_value" >= 0 AND ("markup_type" <> 'PERCENTAGE' OR "markup_value" <= 1000));

ALTER TABLE "products"
    ADD CONSTRAINT "products_price_nonnegative_check" CHECK ("price" >= 0),
    ADD CONSTRAINT "products_supplier_price_nonnegative_check" CHECK ("supplier_price" IS NULL OR "supplier_price" >= 0);

ALTER TABLE "product_variants"
    ADD CONSTRAINT "product_variants_price_nonnegative_check" CHECK ("price" >= 0),
    ADD CONSTRAINT "product_variants_stock_nonnegative_check" CHECK ("stock_on_hand" >= 0);

ALTER TABLE "digital_assets"
    ADD CONSTRAINT "digital_assets_payload_check"
    CHECK (
        ("type" = 'DOWNLOAD' AND "file_name" IS NOT NULL AND "download_url" IS NOT NULL AND "encrypted_value" IS NULL AND "secret_fingerprint" IS NULL)
        OR
        ("type" = 'LICENSE_KEY' AND "encrypted_value" IS NOT NULL AND "secret_fingerprint" IS NOT NULL AND "download_url" IS NULL)
    );

ALTER TABLE "inventory_batches"
    ADD CONSTRAINT "inventory_batches_quantity_check"
    CHECK ("quantity_received" > 0 AND "quantity_remaining" >= 0 AND "quantity_remaining" <= "quantity_received"),
    ADD CONSTRAINT "inventory_batches_unit_cost_check" CHECK ("unit_cost" >= 0);

ALTER TABLE "stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_nonzero_check" CHECK ("quantity_change" <> 0),
    ADD CONSTRAINT "stock_adjustments_direction_check"
    CHECK (
        ("type" IN ('OPENING', 'RECEIVE', 'RETURN', 'TRANSFER_IN') AND "quantity_change" > 0)
        OR ("type" IN ('DAMAGE', 'LOSS', 'TRANSFER_OUT') AND "quantity_change" < 0)
        OR "type" IN ('CORRECTION', 'RESELLER_SYNC')
    );

ALTER TABLE "stock_transfers"
    ADD CONSTRAINT "stock_transfers_quantity_check" CHECK ("quantity" > 0),
    ADD CONSTRAINT "stock_transfers_distinct_warehouses_check" CHECK ("from_warehouse_id" <> "to_warehouse_id");

ALTER TABLE "stock_transfer_batches"
    ADD CONSTRAINT "stock_transfer_batches_quantity_check" CHECK ("quantity" > 0);
