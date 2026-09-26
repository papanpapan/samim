-- Nursery display currency: BDT (৳) or INR (₹). Existing rows stay BDT.

ALTER TABLE "Nursery" ADD COLUMN "currencyCode" TEXT NOT NULL DEFAULT 'BDT';
