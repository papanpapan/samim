CREATE TABLE "MarketingMedia" (
    "id" TEXT NOT NULL,
    "nurseryId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingMedia_nurseryId_category_idx" ON "MarketingMedia"("nurseryId", "category");

ALTER TABLE "MarketingMedia" ADD CONSTRAINT "MarketingMedia_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
