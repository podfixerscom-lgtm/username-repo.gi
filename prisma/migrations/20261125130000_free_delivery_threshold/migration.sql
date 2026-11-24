ALTER TABLE "general_settings"
    ADD COLUMN "free_delivery_above_bdt" DECIMAL(12,2),
    ADD CONSTRAINT "general_settings_free_delivery_above_bdt_check"
        CHECK ("free_delivery_above_bdt" IS NULL OR "free_delivery_above_bdt" >= 0);
