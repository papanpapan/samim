-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'STAFF', 'CASHIER');

-- CreateEnum
CREATE TYPE "PropagationMethod" AS ENUM ('AIR_LAYERING', 'SOFTWOOD_GRAFTING', 'CLEFT_GRAFTING', 'PATCH_BUDDING', 'CUTTING', 'SEEDLING');

-- CreateEnum
CREATE TYPE "BatchStage" AS ENUM ('INITIATED', 'MIST_CHAMBER', 'HARDENING_SHADE', 'READY_FOR_SALE', 'CLOSED');

-- CreateEnum
CREATE TYPE "SalesChannel" AS ENUM ('RETAIL_COUNTER', 'WHOLESALE_ORCHARDIST', 'INDIAMART', 'MEESHO', 'AMAZON');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'UPI_PHONEPE_GPAY', 'BANK_NEFT_IMPS', 'CREDIT_NOTE', 'SPLIT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotherPlant" (
    "id" TEXT NOT NULL,
    "tagNumber" TEXT NOT NULL,
    "varietyName" TEXT NOT NULL,
    "scientificName" TEXT,
    "sourceCountry" TEXT,
    "plantingDate" TIMESTAMP(3) NOT NULL,
    "plotLocation" TEXT NOT NULL,
    "healthStatus" TEXT NOT NULL DEFAULT 'EXCELLENT',
    "scionsHarvested" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotherPlant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropagationBatch" (
    "id" TEXT NOT NULL,
    "batchCode" TEXT NOT NULL,
    "motherPlantId" TEXT NOT NULL,
    "method" "PropagationMethod" NOT NULL,
    "initialQuantity" INTEGER NOT NULL,
    "currentQuantity" INTEGER NOT NULL,
    "mortalityCount" INTEGER NOT NULL DEFAULT 0,
    "stage" "BatchStage" NOT NULL DEFAULT 'INITIATED',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mistChamberDate" TIMESTAMP(3),
    "hardeningDate" TIMESTAMP(3),
    "readyDate" TIMESTAMP(3),

    CONSTRAINT "PropagationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantInventory" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "commonName" TEXT NOT NULL,
    "variety" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "bagSize" TEXT NOT NULL,
    "currentStock" INTEGER NOT NULL DEFAULT 0,
    "reorderAlert" INTEGER NOT NULL DEFAULT 15,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "retailPrice" DECIMAL(10,2) NOT NULL,
    "wholesalePrice" DECIMAL(10,2) NOT NULL,
    "qrCodeData" TEXT,
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VermicompostBed" (
    "id" TEXT NOT NULL,
    "bedCode" TEXT NOT NULL,
    "rawBiomassKg" DECIMAL(10,2) NOT NULL,
    "cowDungKg" DECIMAL(10,2) NOT NULL,
    "speciesWorms" TEXT NOT NULL DEFAULT 'Eisenia foetida',
    "startDate" TIMESTAMP(3) NOT NULL,
    "expectedDate" TIMESTAMP(3) NOT NULL,
    "harvestedDate" TIMESTAMP(3),
    "actualYieldKg" DECIMAL(10,2),
    "qualityGrade" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DECOMPOSING',

    CONSTRAINT "VermicompostBed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLedger" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "deltaQty" INTEGER NOT NULL,
    "closingQty" INTEGER NOT NULL,
    "actionType" TEXT NOT NULL,
    "referenceNo" TEXT,
    "recordedBy" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "channel" "SalesChannel" NOT NULL DEFAULT 'RETAIL_COUNTER',
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerCity" TEXT,
    "subTotal" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
    "netTotal" DECIMAL(12,2) NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL DEFAULT 'CASH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "itemTotalPrice" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareSchedule" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "scheduledOn" TIMESTAMP(3) NOT NULL,
    "completedOn" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "staffNotes" TEXT,

    CONSTRAINT "CareSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MotherPlant_tagNumber_key" ON "MotherPlant"("tagNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PropagationBatch_batchCode_key" ON "PropagationBatch"("batchCode");

-- CreateIndex
CREATE UNIQUE INDEX "PlantInventory_sku_key" ON "PlantInventory"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "VermicompostBed_bedCode_key" ON "VermicompostBed"("bedCode");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_invoiceNumber_key" ON "Sale"("invoiceNumber");

-- AddForeignKey
ALTER TABLE "PropagationBatch" ADD CONSTRAINT "PropagationBatch_motherPlantId_fkey" FOREIGN KEY ("motherPlantId") REFERENCES "MotherPlant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantInventory" ADD CONSTRAINT "PlantInventory_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PropagationBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedger" ADD CONSTRAINT "StockLedger_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "PlantInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "PlantInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareSchedule" ADD CONSTRAINT "CareSchedule_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "PlantInventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
