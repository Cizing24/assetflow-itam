-- PostgreSQL CHECK accepts UNKNOWN, so nullable completion fields need explicit IS NOT NULL.
ALTER TABLE "AssetAssignment" DROP CONSTRAINT "complete_return_fields";
ALTER TABLE "AssetAssignment" ADD CONSTRAINT "complete_return_fields" CHECK (
  ("returnedAt" IS NULL AND "checkinById" IS NULL AND "condition" IS NULL)
  OR ("returnedAt" IS NOT NULL AND "checkinById" IS NOT NULL AND "condition" IS NOT NULL AND "condition" IN ('GOOD','DAMAGED') AND "returnedAt" >= "checkedOutAt")
);
ALTER TABLE "MaintenanceRecord" DROP CONSTRAINT "complete_maintenance_fields";
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "complete_maintenance_fields" CHECK (
  ("completedAt" IS NULL AND "outcome" IS NULL)
  OR ("completedAt" IS NOT NULL AND "outcome" IS NOT NULL AND "outcome" IN ('AVAILABLE','RETIRED') AND "completedAt" >= "startedAt")
);
