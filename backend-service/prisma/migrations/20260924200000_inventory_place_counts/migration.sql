ALTER TABLE "PlantInventory" ADD COLUMN "plantHeight" TEXT;
ALTER TABLE "PlantInventory" ADD COLUMN "plantAge" TEXT;
ALTER TABLE "PlantInventory" ADD COLUMN "zoneLabel" TEXT;
ALTER TABLE "PlantInventory" ADD COLUMN "reservedQty" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlantInventory" ADD COLUMN "soldQty" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlantInventory" ADD COLUMN "mortalityQty" INTEGER NOT NULL DEFAULT 0;

UPDATE "PlantInventory" AS p
SET "soldQty" = COALESCE((
  SELECT SUM(si.quantity)::int FROM "SaleItem" si WHERE si."plantId" = p.id
), 0);

UPDATE "PlantInventory" AS p
SET "mortalityQty" = COALESCE((
  SELECT SUM((-sl."deltaQty"))::int FROM "StockLedger" sl
  WHERE sl."plantId" = p.id AND sl."actionType" = 'MORTALITY' AND sl."deltaQty" < 0
), 0);
