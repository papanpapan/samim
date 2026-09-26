-- CreateEnum
CREATE TYPE "PhenologyKind" AS ENUM ('FLOWERING', 'FRUITING');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('FERTILIZER', 'POLYBAGS', 'COCOPEAT', 'LABOUR', 'ELECTRICITY', 'OTHER');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ManifestStatus" AS ENUM ('DRAFT', 'DISPATCHED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('INDIAMART', 'MEESHO', 'AMAZON');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'CLOSED');

-- AlterTable
ALTER TABLE "VermicompostBed" ADD COLUMN "allocation" TEXT,
ADD COLUMN "costPerKg" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "PhenologyLog" (
    "id" TEXT NOT NULL,
    "motherPlantId" TEXT NOT NULL,
    "kind" "PhenologyKind" NOT NULL,
    "observedOn" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhenologyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MistReading" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "temperatureC" DECIMAL(5,2) NOT NULL,
    "humidityPct" DECIMAL(5,2) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT NOT NULL,

    CONSTRAINT "MistReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BedMoistureLog" (
    "id" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "moisturePct" DECIMAL(5,2) NOT NULL,
    "notes" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BedMoistureLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "spentOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerCity" TEXT,
    "variety" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "neededBy" TIMESTAMP(3),
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportManifest" (
    "id" TEXT NOT NULL,
    "manifestNo" TEXT NOT NULL,
    "bookingId" TEXT,
    "destination" TEXT NOT NULL,
    "vehicleNo" TEXT,
    "driverName" TEXT,
    "cargoSummary" TEXT NOT NULL,
    "status" "ManifestStatus" NOT NULL DEFAULT 'DRAFT',
    "dispatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransportManifest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceLead" (
    "id" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL,
    "contactName" TEXT NOT NULL,
    "phone" TEXT,
    "productInterest" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketplaceLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiseaseLog" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "plantId" TEXT,
    "diagnosis" TEXT NOT NULL,
    "treatment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "observedOn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedOn" TIMESTAMP(3),
    "staffNotes" TEXT,

    CONSTRAINT "DiseaseLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransportManifest_manifestNo_key" ON "TransportManifest"("manifestNo");

-- AddForeignKey
ALTER TABLE "PhenologyLog" ADD CONSTRAINT "PhenologyLog_motherPlantId_fkey" FOREIGN KEY ("motherPlantId") REFERENCES "MotherPlant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MistReading" ADD CONSTRAINT "MistReading_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PropagationBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedMoistureLog" ADD CONSTRAINT "BedMoistureLog_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "VermicompostBed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportManifest" ADD CONSTRAINT "TransportManifest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
