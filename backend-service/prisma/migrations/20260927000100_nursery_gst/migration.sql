-- Nursery GST defaults for India-first POS (local slabs, not government e-invoice)
ALTER TABLE "Nursery" ADD COLUMN IF NOT EXISTS "gstDefaultPct" DECIMAL(5,2) NOT NULL DEFAULT 0;
ALTER TABLE "Nursery" ADD COLUMN IF NOT EXISTS "gstSlabs" TEXT NOT NULL DEFAULT '0,5,12,18';
