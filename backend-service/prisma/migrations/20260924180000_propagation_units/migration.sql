CREATE TYPE "UnitStatus" AS ENUM ('GROWING', 'LOST', 'READY');

ALTER TABLE "PropagationBatch" ADD COLUMN "shareCode" TEXT;

CREATE UNIQUE INDEX "PropagationBatch_shareCode_key" ON "PropagationBatch"("shareCode");

CREATE TABLE "PropagationUnit" (
    "id" TEXT NOT NULL,
    "nurseryId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "serialNo" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'GROWING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropagationUnit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PropagationUnit_code_key" ON "PropagationUnit"("code");
CREATE UNIQUE INDEX "PropagationUnit_batchId_serialNo_key" ON "PropagationUnit"("batchId", "serialNo");
CREATE INDEX "PropagationUnit_nurseryId_idx" ON "PropagationUnit"("nurseryId");
CREATE INDEX "PropagationUnit_batchId_idx" ON "PropagationUnit"("batchId");

ALTER TABLE "PropagationUnit" ADD CONSTRAINT "PropagationUnit_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PropagationUnit" ADD CONSTRAINT "PropagationUnit_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PropagationBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
