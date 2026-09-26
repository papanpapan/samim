-- One mother-plant record can stand for many trees of one variety at one place.
-- The record still has a single share code for the catalog.

ALTER TABLE "MotherPlant" ADD COLUMN "plantCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "MotherPlant" ADD COLUMN "locationId" TEXT;

ALTER TABLE "MotherPlant"
  ADD CONSTRAINT "MotherPlant_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "NurseryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MotherPlant_locationId_idx" ON "MotherPlant"("locationId");
