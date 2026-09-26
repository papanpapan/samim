-- Feature catalog plus nursery safety, treatment, and leaf identification.

CREATE TABLE "FeatureCatalog" (
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "FeatureCatalog_pkey" PRIMARY KEY ("key")
);

INSERT INTO "FeatureCatalog" ("key", "label", "description", "system", "active", "sortOrder") VALUES
  ('MOTHER_PLANTS', 'Mother plants', 'Mother plant registry', true, true, 10),
  ('PROPAGATION', 'Propagation', 'Propagation batches', true, true, 20),
  ('INVENTORY', 'Inventory', 'Live plant stock', true, true, 30),
  ('POS', 'Sales counter', 'Point of sale', true, true, 40),
  ('VERMICOMPOST', 'Vermicompost', 'Vermicompost beds', true, true, 50),
  ('CARE', 'Care', 'Watering and care calendar', true, true, 60),
  ('DISTRIBUTION', 'Distribution', 'Bookings and dispatch', true, true, 70),
  ('ACCOUNTS', 'Accounts', 'Expenses and profit', true, true, 80),
  ('NURSERY_ADMIN', 'User admin', 'Nursery staff and roles', true, true, 90),
  ('CCTV_ALERTS', 'CCTV danger alerts', 'Camera zones and danger alerts', true, true, 100),
  ('VOICE_DESK', 'Voice desk', 'Ask stock and sales by voice', true, true, 110),
  ('PLANT_TREATMENT', 'Plant treatment', 'Treatment plans', true, true, 120),
  ('PLANT_ID', 'Identify plant', 'Name a plant from its leaf', true, true, 130);

INSERT INTO "NurseryFeature" ("id", "nurseryId", "feature", "enabled")
SELECT gen_random_uuid()::text, n.id, f.key, true
FROM "Nursery" n
CROSS JOIN (VALUES ('CCTV_ALERTS'), ('VOICE_DESK'), ('PLANT_TREATMENT'), ('PLANT_ID')) AS f(key)
WHERE NOT EXISTS (
  SELECT 1 FROM "NurseryFeature" existing
  WHERE existing."nurseryId" = n.id AND existing.feature = f.key
);

CREATE TABLE "CameraZone" (
    "id" TEXT NOT NULL,
    "nurseryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CameraZone_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CameraZone_nurseryId_idx" ON "CameraZone"("nurseryId");
ALTER TABLE "CameraZone" ADD CONSTRAINT "CameraZone_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DangerAlert" (
    "id" TEXT NOT NULL,
    "nurseryId" TEXT NOT NULL,
    "zoneId" TEXT,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'HIGH',
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "raisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "DangerAlert_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DangerAlert_nurseryId_idx" ON "DangerAlert"("nurseryId");
ALTER TABLE "DangerAlert" ADD CONSTRAINT "DangerAlert_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DangerAlert" ADD CONSTRAINT "DangerAlert_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "CameraZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "TreatmentPlan" (
    "id" TEXT NOT NULL,
    "nurseryId" TEXT NOT NULL,
    "plantName" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "treatedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TreatmentPlan_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TreatmentPlan_nurseryId_idx" ON "TreatmentPlan"("nurseryId");
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PlantIdentification" (
    "id" TEXT NOT NULL,
    "nurseryId" TEXT NOT NULL,
    "traits" TEXT NOT NULL,
    "matchName" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlantIdentification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PlantIdentification_nurseryId_idx" ON "PlantIdentification"("nurseryId");
ALTER TABLE "PlantIdentification" ADD CONSTRAINT "PlantIdentification_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "FeatureNote" (
    "id" TEXT NOT NULL,
    "nurseryId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeatureNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FeatureNote_nurseryId_idx" ON "FeatureNote"("nurseryId");
ALTER TABLE "FeatureNote" ADD CONSTRAINT "FeatureNote_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
