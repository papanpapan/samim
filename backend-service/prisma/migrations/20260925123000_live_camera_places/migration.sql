-- Live cameras hang off the places saved during nursery onboarding.
DROP TABLE IF EXISTS "LiveCamera";
DROP TABLE IF EXISTS "LiveField";

CREATE TABLE "LiveCamera" (
    "id" TEXT NOT NULL,
    "nurseryId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiveCamera_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LiveCamera_nurseryId_locationId_idx" ON "LiveCamera"("nurseryId", "locationId");

ALTER TABLE "LiveCamera" ADD CONSTRAINT "LiveCamera_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveCamera" ADD CONSTRAINT "LiveCamera_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "NurseryLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
