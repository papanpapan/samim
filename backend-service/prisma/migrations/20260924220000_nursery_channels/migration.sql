CREATE TABLE "NurseryChannel" (
    "id" TEXT NOT NULL,
    "nurseryId" TEXT NOT NULL,
    "channel" "SalesChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "NurseryChannel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NurseryChannel_nurseryId_channel_key" ON "NurseryChannel"("nurseryId", "channel");
CREATE INDEX "NurseryChannel_nurseryId_idx" ON "NurseryChannel"("nurseryId");

ALTER TABLE "NurseryChannel" ADD CONSTRAINT "NurseryChannel_nurseryId_fkey" FOREIGN KEY ("nurseryId") REFERENCES "Nursery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "NurseryChannel" ("id", "nurseryId", "channel", "enabled")
SELECT gen_random_uuid()::text, n."id", c.channel, c.enabled
FROM "Nursery" n
CROSS JOIN (VALUES
  ('RETAIL_COUNTER'::"SalesChannel", true),
  ('WHOLESALE_ORCHARDIST'::"SalesChannel", true),
  ('INDIAMART'::"SalesChannel", true),
  ('MEESHO'::"SalesChannel", true),
  ('AMAZON'::"SalesChannel", false)
) AS c(channel, enabled);
