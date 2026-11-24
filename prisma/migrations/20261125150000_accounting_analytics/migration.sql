CREATE TYPE "FinancialAccountType" AS ENUM ('CASH', 'BANK', 'MOBILE_WALLET', 'OTHER');
CREATE TYPE "AccountingCategoryType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "AccountingTransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'PAID');
CREATE TYPE "CourierSettlementStatus" AS ENUM ('PENDING', 'RECONCILED');

CREATE TABLE "financial_accounts" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "FinancialAccountType" NOT NULL,
    "provider" VARCHAR(80),
    "account_reference" VARCHAR(80),
    "opening_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "financial_accounts_opening_balance_check" CHECK ("opening_balance" >= 0)
);

CREATE TABLE "accounting_categories" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "AccountingCategoryType" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounting_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "courier_settlements" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "expected_cod" DECIMAL(12,2) NOT NULL,
    "received_amount" DECIMAL(12,2) NOT NULL,
    "courier_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "CourierSettlementStatus" NOT NULL DEFAULT 'PENDING',
    "payment_reference" VARCHAR(160),
    "reconciled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "courier_settlements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "courier_settlements_amount_check" CHECK (
        "expected_cod" >= 0 AND "received_amount" >= 0
        AND "courier_fee" >= 0 AND "courier_fee" <= "received_amount"
    ),
    CONSTRAINT "courier_settlements_status_check" CHECK (
        ("status" = 'PENDING' AND "reconciled_at" IS NULL)
        OR ("status" = 'RECONCILED' AND "reconciled_at" IS NOT NULL)
    )
);

CREATE TABLE "accounting_transactions" (
    "id" TEXT NOT NULL,
    "type" "AccountingTransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "account_id" TEXT NOT NULL,
    "destination_account_id" TEXT,
    "category_id" TEXT,
    "created_by_id" TEXT,
    "courier_settlement_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "accounting_transactions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "accounting_transactions_amount_check" CHECK ("amount" > 0),
    CONSTRAINT "accounting_transactions_shape_check" CHECK (
        ("type" = 'TRANSFER' AND "destination_account_id" IS NOT NULL
            AND "destination_account_id" <> "account_id" AND "category_id" IS NULL)
        OR
        ("type" IN ('INCOME', 'EXPENSE') AND "destination_account_id" IS NULL
            AND "category_id" IS NOT NULL)
    )
);

CREATE TABLE "payroll_records" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "base_salary" DECIMAL(12,2) NOT NULL,
    "allowances" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "net_pay" DECIMAL(12,2) NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "paid_at" TIMESTAMP(3),
    "transaction_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payroll_records_period_check" CHECK ("period" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT "payroll_records_amount_check" CHECK (
        "base_salary" >= 0 AND "allowances" >= 0 AND "deductions" >= 0
        AND "deductions" <= "base_salary" + "allowances"
        AND "net_pay" = "base_salary" + "allowances" - "deductions"
    ),
    CONSTRAINT "payroll_records_status_check" CHECK (
        ("status" = 'DRAFT' AND "paid_at" IS NULL AND "transaction_id" IS NULL)
        OR ("status" = 'PAID' AND "paid_at" IS NOT NULL AND "transaction_id" IS NOT NULL)
    )
);

CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" VARCHAR(120) NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "financial_accounts_name_key" ON "financial_accounts"("name");
CREATE INDEX "financial_accounts_is_active_type_idx" ON "financial_accounts"("is_active", "type");
CREATE UNIQUE INDEX "accounting_categories_name_type_key" ON "accounting_categories"("name", "type");
CREATE INDEX "accounting_categories_type_is_active_idx" ON "accounting_categories"("type", "is_active");
CREATE UNIQUE INDEX "courier_settlements_booking_id_key" ON "courier_settlements"("booking_id");
CREATE INDEX "courier_settlements_status_created_at_idx" ON "courier_settlements"("status", "created_at");
CREATE INDEX "accounting_transactions_occurred_at_type_idx" ON "accounting_transactions"("occurred_at", "type");
CREATE INDEX "accounting_transactions_account_id_occurred_at_idx" ON "accounting_transactions"("account_id", "occurred_at");
CREATE INDEX "accounting_transactions_category_id_occurred_at_idx" ON "accounting_transactions"("category_id", "occurred_at");
CREATE INDEX "accounting_transactions_courier_settlement_id_idx" ON "accounting_transactions"("courier_settlement_id");
CREATE UNIQUE INDEX "payroll_records_transaction_id_key" ON "payroll_records"("transaction_id");
CREATE UNIQUE INDEX "payroll_records_employee_id_period_key" ON "payroll_records"("employee_id", "period");
CREATE INDEX "payroll_records_period_status_idx" ON "payroll_records"("period", "status");
CREATE INDEX "activity_logs_created_at_idx" ON "activity_logs"("created_at");
CREATE INDEX "activity_logs_entity_type_entity_id_created_at_idx" ON "activity_logs"("entity_type", "entity_id", "created_at");
CREATE INDEX "activity_logs_actor_id_created_at_idx" ON "activity_logs"("actor_id", "created_at");

ALTER TABLE "courier_settlements"
    ADD CONSTRAINT "courier_settlements_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "courier_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "courier_settlements_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "courier_settlements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting_transactions"
    ADD CONSTRAINT "accounting_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "accounting_transactions_destination_account_id_fkey" FOREIGN KEY ("destination_account_id") REFERENCES "financial_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "accounting_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "accounting_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "accounting_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "accounting_transactions_courier_settlement_id_fkey" FOREIGN KEY ("courier_settlement_id") REFERENCES "courier_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_records"
    ADD CONSTRAINT "payroll_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "payroll_records_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "payroll_records_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "accounting_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "activity_logs"
    ADD CONSTRAINT "activity_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
