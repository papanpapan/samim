-- Which onboarded features each role inside a nursery may use.

CREATE TABLE "NurseryRoleFeature" (
    "id" TEXT NOT NULL,
    "nurseryId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "feature" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "NurseryRoleFeature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NurseryRoleFeature_nurseryId_role_feature_key" ON "NurseryRoleFeature"("nurseryId", "role", "feature");
CREATE INDEX "NurseryRoleFeature_nurseryId_role_idx" ON "NurseryRoleFeature"("nurseryId", "role");

ALTER TABLE "NurseryRoleFeature"
  ADD CONSTRAINT "NurseryRoleFeature_nurseryId_fkey"
  FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
