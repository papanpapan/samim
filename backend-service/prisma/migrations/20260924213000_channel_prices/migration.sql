CREATE TABLE "PlantChannelPrice" (
    "id" TEXT NOT NULL,
    "nurseryId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "channel" "SalesChannel" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlantChannelPrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlantChannelPrice_plantId_channel_key" ON "PlantChannelPrice"("plantId", "channel");
CREATE INDEX "PlantChannelPrice_nurseryId_idx" ON "PlantChannelPrice"("nurseryId");

ALTER TABLE "PlantChannelPrice" ADD CONSTRAINT "PlantChannelPrice_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlantChannelPrice" ADD CONSTRAINT "PlantChannelPrice_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "PlantInventory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PlantChannelPrice" ("id", "nurseryId", "plantId", "channel", "price", "updatedAt")
SELECT gen_random_uuid()::text, "nurseryId", "id", 'RETAIL_COUNTER', "retailPrice", CURRENT_TIMESTAMP FROM "PlantInventory";

INSERT INTO "PlantChannelPrice" ("id", "nurseryId", "plantId", "channel", "price", "updatedAt")
SELECT gen_random_uuid()::text, "nurseryId", "id", 'WHOLESALE_ORCHARDIST', "wholesalePrice", CURRENT_TIMESTAMP FROM "PlantInventory";

INSERT INTO "PlantChannelPrice" ("id", "nurseryId", "plantId", "channel", "price", "updatedAt")
SELECT gen_random_uuid()::text, "nurseryId", "id", 'INDIAMART', "retailPrice", CURRENT_TIMESTAMP FROM "PlantInventory";

INSERT INTO "PlantChannelPrice" ("id", "nurseryId", "plantId", "channel", "price", "updatedAt")
SELECT gen_random_uuid()::text, "nurseryId", "id", 'MEESHO', "retailPrice", CURRENT_TIMESTAMP FROM "PlantInventory";
