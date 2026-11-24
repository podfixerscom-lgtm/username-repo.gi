CREATE TYPE "OrderSource" AS ENUM ('WEB', 'FACEBOOK', 'PHONE', 'POS');
CREATE TYPE "CourierProvider" AS ENUM ('STEADFAST', 'PATHAO', 'REDX');
CREATE TYPE "CourierBookingStatus" AS ENUM ('PENDING', 'BOOKED', 'FAILED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED', 'CANCELLED');
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');
CREATE TYPE "FraudRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'UNKNOWN');

ALTER TYPE "PaymentMethod" ADD VALUE 'CASH';
ALTER TYPE "OrderStatus" ADD VALUE 'PACKED';
ALTER TYPE "OrderStatus" ADD VALUE 'SHIPPED';
ALTER TYPE "OrderStatus" ADD VALUE 'DELIVERED';
ALTER TYPE "OrderStatus" ADD VALUE 'RETURNED';

CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(40) NOT NULL,
    "email" VARCHAR(254),
    "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
    "marketing_consent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

WITH normalized_orders AS (
    SELECT
        CASE
            WHEN digits LIKE '00880%' THEN '0' || SUBSTRING(digits FROM 6)
            WHEN digits LIKE '880%' THEN '0' || SUBSTRING(digits FROM 4)
            ELSE digits
        END AS normalized_phone,
        customer_name,
        customer_email,
        created_at,
        updated_at
    FROM (
        SELECT
            regexp_replace(customer_phone, '[^0-9]', '', 'g') AS digits,
            customer_name,
            customer_email,
            created_at,
            updated_at
        FROM orders
        WHERE customer_phone <> ''
            AND length(regexp_replace(customer_phone, '[^0-9]', '', 'g')) >= 8
    ) AS source
)
INSERT INTO "customers" ("id", "name", "phone", "email", "created_at", "updated_at")
SELECT DISTINCT ON (normalized_phone)
    'cust_' || md5(normalized_phone),
    customer_name,
    normalized_phone,
    customer_email,
    created_at,
    updated_at
FROM normalized_orders
WHERE normalized_phone <> ''
ORDER BY normalized_phone, created_at DESC, customer_name;

ALTER TABLE "orders"
    ADD COLUMN "customer_id" TEXT,
    ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'WEB',
    ADD COLUMN "idempotency_key" VARCHAR(120),
    ADD COLUMN "created_by_id" TEXT;

WITH normalized_orders AS (
    SELECT
        id,
        CASE
            WHEN digits LIKE '00880%' THEN '0' || SUBSTRING(digits FROM 6)
            WHEN digits LIKE '880%' THEN '0' || SUBSTRING(digits FROM 4)
            ELSE digits
        END AS normalized_phone
    FROM (
        SELECT id, regexp_replace(customer_phone, '[^0-9]', '', 'g') AS digits
        FROM orders
        WHERE customer_phone <> ''
            AND length(regexp_replace(customer_phone, '[^0-9]', '', 'g')) >= 8
    ) AS source
)
UPDATE "orders" AS orders
SET "customer_id" = customers.id
FROM normalized_orders
JOIN customers ON customers.phone = normalized_orders.normalized_phone
WHERE orders.id = normalized_orders.id;

CREATE TABLE "order_notes" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "author_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "author_id" TEXT,
    "from_status" "OrderStatus",
    "to_status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "courier_provider_settings" (
    "id" TEXT NOT NULL,
    "provider" "CourierProvider" NOT NULL,
    "encrypted_credentials" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "courier_provider_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "courier_bookings" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "provider" "CourierProvider" NOT NULL,
    "status" "CourierBookingStatus" NOT NULL DEFAULT 'PENDING',
    "tracking_number" VARCHAR(180),
    "consignment_id" VARCHAR(180),
    "idempotency_key" VARCHAR(120) NOT NULL,
    "error_message" TEXT,
    "booked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "courier_bookings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "fraud_checks" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "risk_level" "FraudRiskLevel" NOT NULL,
    "summary" TEXT NOT NULL,
    "external_ref" VARCHAR(180),
    "checked_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fraud_checks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(40),
    "email" VARCHAR(254),
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'ORDERED',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "quantity_ordered" INTEGER NOT NULL,
    "quantity_received" INTEGER NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "purchase_order_items_quantity_check"
        CHECK ("quantity_ordered" > 0 AND "quantity_received" >= 0 AND "quantity_received" <= "quantity_ordered"),
    CONSTRAINT "purchase_order_items_unit_cost_check" CHECK ("unit_cost" >= 0)
);

ALTER TABLE "inventory_batches" ADD COLUMN "purchase_order_item_id" TEXT;

CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");
CREATE INDEX "orders_source_created_at_idx" ON "orders"("source", "created_at");
CREATE INDEX "orders_customer_id_created_at_idx" ON "orders"("customer_id", "created_at");
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");
CREATE INDEX "order_notes_order_id_created_at_idx" ON "order_notes"("order_id", "created_at");
CREATE INDEX "order_status_history_order_id_created_at_idx" ON "order_status_history"("order_id", "created_at");
CREATE UNIQUE INDEX "courier_provider_settings_provider_key" ON "courier_provider_settings"("provider");
CREATE UNIQUE INDEX "courier_bookings_idempotency_key_key" ON "courier_bookings"("idempotency_key");
CREATE UNIQUE INDEX "courier_bookings_order_id_provider_key" ON "courier_bookings"("order_id", "provider");
CREATE INDEX "courier_bookings_provider_status_created_at_idx" ON "courier_bookings"("provider", "status", "created_at");
CREATE INDEX "fraud_checks_order_id_created_at_idx" ON "fraud_checks"("order_id", "created_at");
CREATE UNIQUE INDEX "suppliers_name_key" ON "suppliers"("name");
CREATE INDEX "purchase_orders_status_created_at_idx" ON "purchase_orders"("status", "created_at");
CREATE INDEX "purchase_orders_supplier_id_created_at_idx" ON "purchase_orders"("supplier_id", "created_at");
CREATE INDEX "purchase_order_items_purchase_order_id_idx" ON "purchase_order_items"("purchase_order_id");
CREATE INDEX "inventory_batches_purchase_order_item_id_idx" ON "inventory_batches"("purchase_order_item_id");

ALTER TABLE "orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_notes"
    ADD CONSTRAINT "order_notes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "order_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_status_history"
    ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "order_status_history_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "courier_bookings"
    ADD CONSTRAINT "courier_bookings_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "fraud_checks"
    ADD CONSTRAINT "fraud_checks_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "fraud_checks_checked_by_id_fkey" FOREIGN KEY ("checked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_orders"
    ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "purchase_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_order_items"
    ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "purchase_order_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_batches"
    ADD CONSTRAINT "inventory_batches_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "purchase_order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_adjustments" DROP CONSTRAINT "stock_adjustments_direction_check";
ALTER TABLE "stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_direction_check"
    CHECK (
        ("type" IN ('OPENING', 'RECEIVE', 'RETURN', 'TRANSFER_IN', 'ORDER_RELEASED') AND "quantity_change" > 0)
        OR ("type" IN ('DAMAGE', 'LOSS', 'TRANSFER_OUT', 'ORDER_RESERVED') AND "quantity_change" < 0)
        OR "type" IN ('CORRECTION', 'RESELLER_SYNC')
    );
