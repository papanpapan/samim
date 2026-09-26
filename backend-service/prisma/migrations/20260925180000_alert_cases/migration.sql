-- AlterTable
ALTER TABLE "DangerAlert" ADD COLUMN IF NOT EXISTS "caseNo" TEXT;
ALTER TABLE "DangerAlert" ADD COLUMN IF NOT EXISTS "history" TEXT;
ALTER TABLE "DangerAlert" ADD COLUMN IF NOT EXISTS "closeNotes" TEXT;
ALTER TABLE "DangerAlert" ADD COLUMN IF NOT EXISTS "videoName" TEXT;
ALTER TABLE "DangerAlert" ADD COLUMN IF NOT EXISTS "cameraId" TEXT;
ALTER TABLE "DangerAlert" ADD COLUMN IF NOT EXISTS "cameraName" TEXT;
ALTER TABLE "DangerAlert" ADD COLUMN IF NOT EXISTS "detectKind" TEXT;
ALTER TABLE "DangerAlert" ADD COLUMN IF NOT EXISTS "ackAt" TIMESTAMP(3);

-- Backfill case numbers for existing rows (unique per nursery)
WITH numbered AS (
  SELECT
    id,
    "nurseryId",
    ROW_NUMBER() OVER (PARTITION BY "nurseryId" ORDER BY "raisedAt") AS n
  FROM "DangerAlert"
  WHERE "caseNo" IS NULL
)
UPDATE "DangerAlert" AS d
SET "caseNo" = 'ACK-LEGACY-' || LPAD(numbered.n::text, 4, '0')
FROM numbered
WHERE d.id = numbered.id;

-- Enforce NOT NULL + unique
ALTER TABLE "DangerAlert" ALTER COLUMN "caseNo" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "DangerAlert_nurseryId_caseNo_key" ON "DangerAlert"("nurseryId", "caseNo");
