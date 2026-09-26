-- Separate live-camera feature. Off until the platform owner enables it for a nursery.
CREATE TABLE "LiveField" (
    "id" TEXT NOT NULL,
    "nurseryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiveField_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiveCamera" (
    "id" TEXT NOT NULL,
    "nurseryId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiveCamera_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LiveField_nurseryId_idx" ON "LiveField"("nurseryId");
CREATE INDEX "LiveCamera_nurseryId_fieldId_idx" ON "LiveCamera"("nurseryId", "fieldId");

ALTER TABLE "LiveField" ADD CONSTRAINT "LiveField_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveCamera" ADD CONSTRAINT "LiveCamera_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveCamera" ADD CONSTRAINT "LiveCamera_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "LiveField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "FeatureCatalog" ("key", "label", "description", "system", "active", "sortOrder")
VALUES ('LIVE_CAMERA', 'Live camera', NULL, true, true, 150)
ON CONFLICT ("key") DO NOTHING;
