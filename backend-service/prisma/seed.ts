import { PrismaClient, Role, PropagationMethod, BatchStage } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedDemoMothers } from './demoMothers';

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@sabanursery.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
const SALT = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

async function main() {
  // --- Users (demo admin + team) ---
  const users: { email: string; name: string; role: Role; password: string }[] = [
    { email: ADMIN_EMAIL, name: 'Samim Molla', role: Role.ADMIN, password: ADMIN_PASSWORD },
    { email: 'manager@sabanursery.com', name: 'Nursery Manager', role: Role.MANAGER, password: 'Manager@123' },
    { email: 'cashier@sabanursery.com', name: 'Counter Cashier', role: Role.CASHIER, password: 'Cashier@123' },
    { email: 'staff@sabanursery.com', name: 'Field Horticulturist', role: Role.STAFF, password: 'Staff@123' },
  ];

  const nursery = await prisma.nursery.upsert({
    where: { code: 'SABA' },
    update: { currencyCode: 'BDT' },
    create: { name: 'Saba Nursery', code: 'SABA', city: 'Kolkata', currencyCode: 'BDT' },
  });

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, SALT);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        role: u.role,
        passwordHash,
        isActive: true,
        nurseryId: nursery.id,
        isPlatformOwner: u.email === ADMIN_EMAIL,
      },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
        nurseryId: nursery.id,
        isPlatformOwner: u.email === ADMIN_EMAIL,
      },
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${users.length} users. Admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);

  // --- Mother plants ---
  const mothers = [
    {
      tagNumber: 'MP-BDG-01',
      varietyName: 'Black Diamond Guava',
      scientificName: 'Psidium guajava',
      sourceCountry: 'Thailand',
      plotLocation: 'Plot A, Line 4, Tree 12',
      scionsHarvested: 120,
    },
    {
      tagNumber: 'MP-TKJ-01',
      varietyName: 'Thai King Jamun',
      scientificName: 'Syzygium cumini',
      sourceCountry: 'Vietnam',
      plotLocation: 'Plot B, Line 2, Tree 5',
      scionsHarvested: 80,
    },
    {
      tagNumber: 'MP-RDG-01',
      varietyName: 'Red Diamond Guava',
      scientificName: 'Psidium guajava',
      sourceCountry: 'Malaysia',
      plotLocation: 'Plot A, Line 6, Tree 3',
      scionsHarvested: 45,
    },
  ];
  for (const m of mothers) {
    await prisma.motherPlant.upsert({
      where: { nurseryId_tagNumber: { nurseryId: nursery.id, tagNumber: m.tagNumber } },
      update: {},
      create: {
        ...m,
        nurseryId: nursery.id,
        plantingDate: new Date('2024-03-15'),
        category: m.varietyName.includes('Adenium') ? 'FLOWERING' : 'FRUIT',
        plantName: m.varietyName.split(' ').at(-1) ?? m.varietyName,
        healthStatus: 'HEALTHY',
        propagationMethods: ['GRAFTING_SCION'],
        shareCode: m.tagNumber.replace(/[^A-Za-z0-9]/g, '').toLowerCase(),
      },
    });
  }
  console.log(`Seeded ${mothers.length} mother plants.`);
  const demoCount = await seedDemoMothers(prisma, nursery.id);
  console.log(`Seeded ${demoCount} demo mother plants.`);

  // --- One ready batch + inventory so the dashboard has data ---
  const mother = await prisma.motherPlant.findUnique({
    where: { nurseryId_tagNumber: { nurseryId: nursery.id, tagNumber: 'MP-BDG-01' } },
  });
  if (mother) {
    const batch = await prisma.propagationBatch.upsert({
      where: { nurseryId_batchCode: { nurseryId: nursery.id, batchCode: 'BATCH-2026-BDG-001' } },
      update: {},
      create: {
        nurseryId: nursery.id,
        batchCode: 'BATCH-2026-BDG-001',
        motherPlantId: mother.id,
        method: PropagationMethod.AIR_LAYERING,
        initialQuantity: 500,
        currentQuantity: 460,
        mortalityCount: 40,
        stage: BatchStage.READY_FOR_SALE,
        mistChamberDate: new Date('2026-01-05'),
        hardeningDate: new Date('2026-01-30'),
        readyDate: new Date('2026-02-20'),
      },
    });

    const existing = await prisma.plantInventory.findUnique({
      where: { nurseryId_sku: { nurseryId: nursery.id, sku: 'PLT-BDG-5X7-01' } },
    });
    if (!existing) {
      await prisma.$transaction(async (tx) => {
        const plant = await tx.plantInventory.create({
          data: {
            nurseryId: nursery.id,
            sku: 'PLT-BDG-5X7-01',
            commonName: 'Black Diamond Guava',
            variety: 'Thai Hybrid',
            category: 'Fruit',
            bagSize: '5x7 inch',
            currentStock: 0,
            reorderAlert: 25,
            costPrice: 45.0,
            retailPrice: 180.0,
            wholesalePrice: 120.0,
            batchId: batch.id,
            qrCodeData: 'SKU:PLT-BDG-5X7-01|NAME:Black Diamond Guava|BAG:5x7 inch|MRP:180|BATCH:BATCH-2026-BDG-001',
          },
        });
        await tx.plantInventory.update({
          where: { id: plant.id },
          data: { currentStock: 460 },
        });
        await tx.stockLedger.create({
          data: {
            plantId: plant.id,
            deltaQty: 460,
            closingQty: 460,
            actionType: 'PROPAGATION_READY',
            referenceNo: batch.batchCode,
            recordedBy: 'seed',
          },
        });
      });
    }
    console.log('Seeded demo batch + inventory (PLT-BDG-5X7-01).');
  }

  // --- Vermicompost bed ---
  await prisma.vermicompostBed.upsert({
    where: { nurseryId_bedCode: { nurseryId: nursery.id, bedCode: 'V-BED-01' } },
    update: {},
    create: {
      nurseryId: nursery.id,
      bedCode: 'V-BED-01',
      rawBiomassKg: 300,
      cowDungKg: 1200,
      startDate: new Date('2026-07-01'),
      expectedDate: new Date('2026-09-04'),
      status: 'DECOMPOSING',
    },
  });
  console.log('Seeded vermicompost bed V-BED-01.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
