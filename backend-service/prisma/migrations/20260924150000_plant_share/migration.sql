ALTER TABLE "MotherPlant" ADD COLUMN "listPrice" DECIMAL(12,2);
ALTER TABLE "MotherPlant" ADD COLUMN "videoStoredName" TEXT;
ALTER TABLE "MotherPlant" ADD COLUMN "shareCode" TEXT;

UPDATE "MotherPlant" SET "shareCode" = substr(md5("id"), 1, 12) WHERE "shareCode" IS NULL;

ALTER TABLE "MotherPlant" ALTER COLUMN "shareCode" SET NOT NULL;

CREATE UNIQUE INDEX "MotherPlant_shareCode_key" ON "MotherPlant"("shareCode");
