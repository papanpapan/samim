-- Nursery address, subscription plan, and editable package prices.

ALTER TABLE "Nursery" ADD COLUMN "address" TEXT;
ALTER TABLE "Nursery" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Nursery" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "Nursery" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'FREE';
ALTER TABLE "Nursery" ADD COLUMN "planPrice" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Nursery" ADD COLUMN "userLimit" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Nursery" ADD COLUMN "plantLimit" INTEGER NOT NULL DEFAULT 0;

UPDATE "Nursery" SET "plan" = 'PLATINUM', "planPrice" = 0, "userLimit" = 0, "plantLimit" = 0;

CREATE TABLE "PackagePlan" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "userLimit" INTEGER NOT NULL DEFAULT 2,
    "plantLimit" INTEGER NOT NULL DEFAULT 50,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PackagePlan_pkey" PRIMARY KEY ("code")
);

INSERT INTO "PackagePlan" ("code", "label", "price", "userLimit", "plantLimit", "sortOrder") VALUES
  ('FREE', 'Free', 0, 2, 50, 10),
  ('SILVER', 'Silver', 999, 5, 200, 20),
  ('GOLDEN', 'Golden', 2499, 15, 1000, 30),
  ('PLATINUM', 'Platinum', 4999, 50, 5000, 40);
