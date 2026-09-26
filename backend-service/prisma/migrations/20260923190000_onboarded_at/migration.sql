-- Day the nursery was onboarded. Existing rows keep the day they were created.

ALTER TABLE "Nursery" ADD COLUMN "onboardedAt" DATE;
UPDATE "Nursery" SET "onboardedAt" = ("createdAt" AT TIME ZONE 'UTC')::date;
ALTER TABLE "Nursery" ALTER COLUMN "onboardedAt" SET NOT NULL;
ALTER TABLE "Nursery" ALTER COLUMN "onboardedAt" SET DEFAULT CURRENT_DATE;
