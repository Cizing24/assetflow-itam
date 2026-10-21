-- Prisma schema cannot express these PostgreSQL partial unique indexes.
CREATE UNIQUE INDEX "one_active_assignment_per_asset" ON "AssetAssignment" ("assetId") WHERE "returnedAt" IS NULL;
CREATE UNIQUE INDEX "one_open_maintenance_per_asset" ON "MaintenanceRecord" ("assetId") WHERE "completedAt" IS NULL;
CREATE UNIQUE INDEX "one_open_offboarding_per_employee" ON "Offboarding" ("employeeId") WHERE "completedAt" IS NULL;
ALTER TABLE "Asset" ADD CONSTRAINT "nonnegative_price" CHECK ("purchasePrice" IS NULL OR "purchasePrice" >= 0);
ALTER TABLE "Asset" ADD CONSTRAINT "valid_warranty" CHECK ("warrantyUntil" IS NULL OR "warrantyUntil" >= "purchasedAt");
ALTER TABLE "Employee" ADD CONSTRAINT "valid_employment_dates" CHECK ("leftAt" IS NULL OR "leftAt" >= "joinedAt");
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "complete_return_fields" CHECK (("returnedAt" IS NULL AND "checkinById" IS NULL AND "condition" IS NULL) OR ("returnedAt" IS NOT NULL AND "checkinById" IS NOT NULL AND "condition" IN ('GOOD','DAMAGED') AND "returnedAt" >= "checkedOutAt"));
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "complete_maintenance_fields" CHECK (("completedAt" IS NULL AND "outcome" IS NULL) OR ("completedAt" IS NOT NULL AND "outcome" IN ('AVAILABLE','RETIRED') AND "completedAt" >= "startedAt"));
ALTER TABLE "Offboarding" ADD CONSTRAINT "complete_offboarding_fields" CHECK (("completedAt" IS NULL AND "completedById" IS NULL) OR ("completedAt" IS NOT NULL AND "completedById" IS NOT NULL AND "completedAt" >= "startedAt"));
CREATE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'AuditLog is append-only'; END;
$$;
CREATE TRIGGER "audit_append_only" BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
