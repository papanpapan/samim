-- A nursery can work from more than one place.

CREATE TABLE "NurseryLocation" (
    "id" TEXT NOT NULL,
    "nurseryId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "NurseryLocation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "NurseryLocation"
  ADD CONSTRAINT "NurseryLocation_nurseryId_fkey"
  FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "NurseryLocation" ("id", "nurseryId", "name", "address", "latitude", "longitude", "sortOrder")
SELECT gen_random_uuid()::text,
       "id",
       '',
       COALESCE(NULLIF("address", ''), NULLIF("city", ''), "name"),
       "latitude",
       "longitude",
       0
FROM "Nursery";
