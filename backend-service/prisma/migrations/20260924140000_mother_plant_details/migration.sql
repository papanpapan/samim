CREATE TABLE "PlantName" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantName_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlantName_name_key" ON "PlantName"("name");

INSERT INTO "PlantName" ("id", "name") VALUES
    ('b2000000-0000-4000-8000-000000000001', 'Guava'),
    ('b2000000-0000-4000-8000-000000000002', 'Jamun'),
    ('b2000000-0000-4000-8000-000000000003', 'Jackfruit'),
    ('b2000000-0000-4000-8000-000000000004', 'Adenium'),
    ('b2000000-0000-4000-8000-000000000005', 'Mulberry'),
    ('b2000000-0000-4000-8000-000000000006', 'Blackberry'),
    ('b2000000-0000-4000-8000-000000000007', 'Blueberry');

ALTER TABLE "Variety" ADD COLUMN "plantNameId" TEXT;

CREATE INDEX "Variety_plantNameId_idx" ON "Variety"("plantNameId");

ALTER TABLE "Variety" ADD CONSTRAINT "Variety_plantNameId_fkey" FOREIGN KEY ("plantNameId") REFERENCES "PlantName"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "Variety" SET "plantNameId" = 'b2000000-0000-4000-8000-000000000001' WHERE "name" IN ('Black Diamond Guava', 'Red Diamond Guava', 'Red King Guava', 'Variegated Guava');
UPDATE "Variety" SET "plantNameId" = 'b2000000-0000-4000-8000-000000000002' WHERE "name" IN ('Thai King Jamun', 'Seedless Jamun');
UPDATE "Variety" SET "plantNameId" = 'b2000000-0000-4000-8000-000000000003' WHERE "name" = 'Thai Jackfruit';
UPDATE "Variety" SET "plantNameId" = 'b2000000-0000-4000-8000-000000000004' WHERE "name" = 'Thai Adenium';
UPDATE "Variety" SET "plantNameId" = 'b2000000-0000-4000-8000-000000000005' WHERE "name" = 'Mulberry';
UPDATE "Variety" SET "plantNameId" = 'b2000000-0000-4000-8000-000000000006' WHERE "name" = 'Blackberry';
UPDATE "Variety" SET "plantNameId" = 'b2000000-0000-4000-8000-000000000007' WHERE "name" = 'Blueberry';

ALTER TABLE "MotherPlant" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'FRUIT';
ALTER TABLE "MotherPlant" ADD COLUMN "plantName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "MotherPlant" ADD COLUMN "propagationMethods" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "MotherPlant" ADD COLUMN "sourceVendor" TEXT;
ALTER TABLE "MotherPlant" ADD COLUMN "seasonCapacity" INTEGER;
ALTER TABLE "MotherPlant" ALTER COLUMN "healthStatus" SET DEFAULT 'HEALTHY';

UPDATE "MotherPlant" SET "healthStatus" = 'HEALTHY' WHERE "healthStatus" = 'EXCELLENT';

UPDATE "MotherPlant" SET
    "plantName" = CASE
        WHEN "varietyName" ILIKE '%Guava%' THEN 'Guava'
        WHEN "varietyName" ILIKE '%Jamun%' THEN 'Jamun'
        WHEN "varietyName" ILIKE '%Jackfruit%' THEN 'Jackfruit'
        WHEN "varietyName" ILIKE '%Adenium%' THEN 'Adenium'
        WHEN "varietyName" ILIKE '%Mulberry%' THEN 'Mulberry'
        WHEN "varietyName" ILIKE '%Blackberry%' THEN 'Blackberry'
        WHEN "varietyName" ILIKE '%Blueberry%' THEN 'Blueberry'
        ELSE "varietyName"
    END,
    "category" = CASE WHEN "varietyName" ILIKE '%Adenium%' THEN 'FLOWERING' ELSE 'FRUIT' END
WHERE "plantName" = '';
