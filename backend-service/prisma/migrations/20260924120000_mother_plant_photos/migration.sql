CREATE TABLE "MotherPlantPhoto" (
    "id" TEXT NOT NULL,
    "motherPlantId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotherPlantPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MotherPlantPhoto_motherPlantId_idx" ON "MotherPlantPhoto"("motherPlantId");

ALTER TABLE "MotherPlantPhoto" ADD CONSTRAINT "MotherPlantPhoto_motherPlantId_fkey" FOREIGN KEY ("motherPlantId") REFERENCES "MotherPlant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
