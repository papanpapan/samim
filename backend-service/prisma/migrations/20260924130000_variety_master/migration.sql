CREATE TABLE "Variety" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Variety_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Variety_name_key" ON "Variety"("name");

INSERT INTO "Variety" ("id", "name") VALUES
    ('b1000000-0000-4000-8000-000000000001', 'Black Diamond Guava'),
    ('b1000000-0000-4000-8000-000000000002', 'Red Diamond Guava'),
    ('b1000000-0000-4000-8000-000000000003', 'Red King Guava'),
    ('b1000000-0000-4000-8000-000000000004', 'Variegated Guava'),
    ('b1000000-0000-4000-8000-000000000005', 'Thai King Jamun'),
    ('b1000000-0000-4000-8000-000000000006', 'Seedless Jamun'),
    ('b1000000-0000-4000-8000-000000000007', 'Thai Jackfruit'),
    ('b1000000-0000-4000-8000-000000000008', 'Thai Adenium'),
    ('b1000000-0000-4000-8000-000000000009', 'Mulberry'),
    ('b1000000-0000-4000-8000-000000000010', 'Blackberry'),
    ('b1000000-0000-4000-8000-000000000011', 'Blueberry');
