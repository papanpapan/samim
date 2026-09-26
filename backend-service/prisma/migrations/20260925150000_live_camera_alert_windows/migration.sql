ALTER TABLE "LiveCamera" ADD COLUMN "alertAlways" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LiveCamera" ADD COLUMN "alertConfigured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LiveCamera" ADD COLUMN "alertWindows" JSONB NOT NULL DEFAULT '[]';

UPDATE "LiveCamera"
SET "alertWindows" = jsonb_build_array(jsonb_build_object('from', "alertFrom", 'to', "alertTo")),
    "alertConfigured" = true
WHERE "alertEnabled" = true OR "alertFrom" <> '20:00' OR "alertTo" <> '06:00';

ALTER TABLE "LiveCamera" DROP COLUMN "alertFrom";
ALTER TABLE "LiveCamera" DROP COLUMN "alertTo";
