-- Sales channels become a catalog the platform owner can extend.
ALTER TABLE "Sale" ALTER COLUMN "channel" DROP DEFAULT;
ALTER TABLE "NurseryChannel" ALTER COLUMN "channel" TYPE TEXT USING ("channel"::text);
ALTER TABLE "PlantChannelPrice" ALTER COLUMN "channel" TYPE TEXT USING ("channel"::text);
ALTER TABLE "Sale" ALTER COLUMN "channel" TYPE TEXT USING ("channel"::text);
ALTER TABLE "Sale" ALTER COLUMN "channel" SET DEFAULT 'RETAIL_COUNTER';

DROP TYPE "SalesChannel";

CREATE TABLE "ChannelCatalog" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChannelCatalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChannelCatalog_code_key" ON "ChannelCatalog"("code");

INSERT INTO "ChannelCatalog" ("id", "code", "label", "system", "sortOrder") VALUES
  (gen_random_uuid()::text, 'RETAIL_COUNTER', 'Retail Counter', true, 10),
  (gen_random_uuid()::text, 'WHOLESALE_ORCHARDIST', 'Wholesale Orchardist', false, 20),
  (gen_random_uuid()::text, 'INDIAMART', 'IndiaMART', false, 30),
  (gen_random_uuid()::text, 'MEESHO', 'Meesho', false, 40),
  (gen_random_uuid()::text, 'AMAZON', 'Amazon', false, 50);
