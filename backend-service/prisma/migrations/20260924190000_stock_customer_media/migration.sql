ALTER TABLE "PlantInventory" ADD COLUMN "shareCode" TEXT;
ALTER TABLE "PlantInventory" ADD COLUMN "videoStoredName" TEXT;

CREATE UNIQUE INDEX "PlantInventory_shareCode_key" ON "PlantInventory"("shareCode");

CREATE TABLE "PlantStockPhoto" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantStockPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlantStockPhoto_plantId_idx" ON "PlantStockPhoto"("plantId");

ALTER TABLE "PlantStockPhoto" ADD CONSTRAINT "PlantStockPhoto_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "PlantInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
