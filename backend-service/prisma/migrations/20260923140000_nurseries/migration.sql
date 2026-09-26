-- Multiple nurseries. Existing rows belong to Saba Nursery.
-- Platform owner: admin@sabanursery.com

CREATE TABLE "Nursery" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "city" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Nursery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Nursery_code_key" ON "Nursery"("code");

INSERT INTO "Nursery" ("id", "name", "code", "city", "status", "createdAt")
VALUES ('a0000000-0000-4000-8000-000000000001', 'Saba Nursery', 'SABA', 'Kolkata', 'ACTIVE', CURRENT_TIMESTAMP);

CREATE TABLE "NurseryFeature" (
    "id" TEXT NOT NULL,
    "nurseryId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "NurseryFeature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NurseryFeature_nurseryId_feature_key" ON "NurseryFeature"("nurseryId", "feature");
ALTER TABLE "NurseryFeature" ADD CONSTRAINT "NurseryFeature_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "NurseryFeature" ("id", "nurseryId", "feature", "enabled")
VALUES
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'MOTHER_PLANTS', true),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001', 'PROPAGATION', true),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001', 'INVENTORY', true),
  ('b0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001', 'POS', true),
  ('b0000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001', 'VERMICOMPOST', true),
  ('b0000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001', 'CARE', true),
  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000001', 'DISTRIBUTION', true),
  ('b0000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000001', 'ACCOUNTS', true),
  ('b0000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000001', 'NURSERY_ADMIN', true);

CREATE TABLE "UserFeature" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "UserFeature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserFeature_userId_feature_key" ON "UserFeature"("userId", "feature");

ALTER TABLE "User" ADD COLUMN "isPlatformOwner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "nurseryId" TEXT;

UPDATE "User" SET "nurseryId" = 'a0000000-0000-4000-8000-000000000001';
UPDATE "User" SET "isPlatformOwner" = true WHERE "email" = 'admin@sabanursery.com';

ALTER TABLE "User" ADD CONSTRAINT "User_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserFeature" ADD CONSTRAINT "UserFeature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD COLUMN "nurseryId" TEXT;
UPDATE "AuditLog" SET "nurseryId" = 'a0000000-0000-4000-8000-000000000001';
CREATE INDEX "AuditLog_nurseryId_idx" ON "AuditLog"("nurseryId");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tenant columns. Backfill, then enforce.
ALTER TABLE "MotherPlant" ADD COLUMN "nurseryId" TEXT;
ALTER TABLE "PropagationBatch" ADD COLUMN "nurseryId" TEXT;
ALTER TABLE "PlantInventory" ADD COLUMN "nurseryId" TEXT;
ALTER TABLE "VermicompostBed" ADD COLUMN "nurseryId" TEXT;
ALTER TABLE "Sale" ADD COLUMN "nurseryId" TEXT;
ALTER TABLE "CareSchedule" ADD COLUMN "nurseryId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "nurseryId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "nurseryId" TEXT;
ALTER TABLE "TransportManifest" ADD COLUMN "nurseryId" TEXT;
ALTER TABLE "MarketplaceLead" ADD COLUMN "nurseryId" TEXT;
ALTER TABLE "DiseaseLog" ADD COLUMN "nurseryId" TEXT;

UPDATE "MotherPlant" SET "nurseryId" = 'a0000000-0000-4000-8000-000000000001';
UPDATE "PropagationBatch" SET "nurseryId" = 'a0000000-0000-4000-8000-000000000001';
UPDATE "PlantInventory" SET "nurseryId" = 'a0000000-0000-4000-8000-000000000001';
UPDATE "VermicompostBed" SET "nurseryId" = 'a0000000-0000-4000-8000-000000000001';
UPDATE "Sale" SET "nurseryId" = 'a0000000-0000-4000-8000-000000000001';
UPDATE "CareSchedule" SET "nurseryId" = 'a0000000-0000-4000-8000-000000000001';
UPDATE "Expense" SET "nurseryId" = 'a0000000-0000-4000-8000-000000000001';
UPDATE "Booking" SET "nurseryId" = 'a0000000-0000-4000-8000-000000000001';
UPDATE "TransportManifest" SET "nurseryId" = 'a0000000-0000-4000-8000-000000000001';
UPDATE "MarketplaceLead" SET "nurseryId" = 'a0000000-0000-4000-8000-000000000001';
UPDATE "DiseaseLog" SET "nurseryId" = 'a0000000-0000-4000-8000-000000000001';

ALTER TABLE "MotherPlant" ALTER COLUMN "nurseryId" SET NOT NULL;
ALTER TABLE "PropagationBatch" ALTER COLUMN "nurseryId" SET NOT NULL;
ALTER TABLE "PlantInventory" ALTER COLUMN "nurseryId" SET NOT NULL;
ALTER TABLE "VermicompostBed" ALTER COLUMN "nurseryId" SET NOT NULL;
ALTER TABLE "Sale" ALTER COLUMN "nurseryId" SET NOT NULL;
ALTER TABLE "CareSchedule" ALTER COLUMN "nurseryId" SET NOT NULL;
ALTER TABLE "Expense" ALTER COLUMN "nurseryId" SET NOT NULL;
ALTER TABLE "Booking" ALTER COLUMN "nurseryId" SET NOT NULL;
ALTER TABLE "TransportManifest" ALTER COLUMN "nurseryId" SET NOT NULL;
ALTER TABLE "MarketplaceLead" ALTER COLUMN "nurseryId" SET NOT NULL;
ALTER TABLE "DiseaseLog" ALTER COLUMN "nurseryId" SET NOT NULL;

DROP INDEX "MotherPlant_tagNumber_key";
DROP INDEX "PropagationBatch_batchCode_key";
DROP INDEX "PlantInventory_sku_key";
DROP INDEX "VermicompostBed_bedCode_key";
DROP INDEX "Sale_invoiceNumber_key";
DROP INDEX "TransportManifest_manifestNo_key";

CREATE UNIQUE INDEX "MotherPlant_nurseryId_tagNumber_key" ON "MotherPlant"("nurseryId", "tagNumber");
CREATE UNIQUE INDEX "PropagationBatch_nurseryId_batchCode_key" ON "PropagationBatch"("nurseryId", "batchCode");
CREATE UNIQUE INDEX "PlantInventory_nurseryId_sku_key" ON "PlantInventory"("nurseryId", "sku");
CREATE UNIQUE INDEX "VermicompostBed_nurseryId_bedCode_key" ON "VermicompostBed"("nurseryId", "bedCode");
CREATE UNIQUE INDEX "Sale_nurseryId_invoiceNumber_key" ON "Sale"("nurseryId", "invoiceNumber");
CREATE UNIQUE INDEX "TransportManifest_nurseryId_manifestNo_key" ON "TransportManifest"("nurseryId", "manifestNo");

CREATE INDEX "MotherPlant_nurseryId_idx" ON "MotherPlant"("nurseryId");
CREATE INDEX "PropagationBatch_nurseryId_idx" ON "PropagationBatch"("nurseryId");
CREATE INDEX "PlantInventory_nurseryId_idx" ON "PlantInventory"("nurseryId");
CREATE INDEX "VermicompostBed_nurseryId_idx" ON "VermicompostBed"("nurseryId");
CREATE INDEX "Sale_nurseryId_idx" ON "Sale"("nurseryId");
CREATE INDEX "CareSchedule_nurseryId_idx" ON "CareSchedule"("nurseryId");
CREATE INDEX "Expense_nurseryId_idx" ON "Expense"("nurseryId");
CREATE INDEX "Booking_nurseryId_idx" ON "Booking"("nurseryId");
CREATE INDEX "TransportManifest_nurseryId_idx" ON "TransportManifest"("nurseryId");
CREATE INDEX "MarketplaceLead_nurseryId_idx" ON "MarketplaceLead"("nurseryId");
CREATE INDEX "DiseaseLog_nurseryId_idx" ON "DiseaseLog"("nurseryId");

ALTER TABLE "MotherPlant" ADD CONSTRAINT "MotherPlant_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropagationBatch" ADD CONSTRAINT "PropagationBatch_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlantInventory" ADD CONSTRAINT "PlantInventory_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VermicompostBed" ADD CONSTRAINT "VermicompostBed_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CareSchedule" ADD CONSTRAINT "CareSchedule_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TransportManifest" ADD CONSTRAINT "TransportManifest_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceLead" ADD CONSTRAINT "MarketplaceLead_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiseaseLog" ADD CONSTRAINT "DiseaseLog_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
