import { copyFile, unlink } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const uploadDir = path.join(process.cwd(), 'uploads', 'mother-plants');

const sourcePhotos = [
  '47f9441e-eeaa-4954-a2a5-b0da60cf6fe1.jpg',
  '15135898-fa13-4585-810e-97a75ba54b93.jpg',
];
const sourceVideo = '9ebeab49-8d32-4825-aab3-cb6236f19329.mp4';

const rows = [
  {
    tagNumber: 'MP-BULK-RDG',
    varietyName: 'Red Diamond Guava',
    plantCount: 100,
    listPrice: 450,
    healthStatus: 'FRUITING',
    notes: 'Dummy bulk stock. One catalog QR for 100 Red Diamond mother plants.',
  },
  {
    tagNumber: 'MP-BULK-BDG',
    varietyName: 'Black Diamond Guava',
    plantCount: 200,
    listPrice: 680,
    healthStatus: 'HEALTHY',
    notes: 'Dummy bulk stock. One catalog QR for 200 Black Diamond mother plants.',
  },
];

function shareCode() {
  return `${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

async function attachPhotos(motherPlantId: string) {
  const photos: { motherPlantId: string; kind: string; storedName: string }[] = [];
  for (const [index, file] of sourcePhotos.entries()) {
    const storedName = `${randomUUID()}.jpg`;
    await copyFile(path.join(uploadDir, file), path.join(uploadDir, storedName));
    photos.push({ motherPlantId, kind: index === 0 ? 'PLANT' : 'FRUIT', storedName });
  }
  await prisma.motherPlantPhoto.createMany({ data: photos });
}

async function attachVideo(motherPlantId: string) {
  const videoStoredName = `${randomUUID()}.mp4`;
  await copyFile(path.join(uploadDir, sourceVideo), path.join(uploadDir, videoStoredName));
  await prisma.motherPlant.update({ where: { id: motherPlantId }, data: { videoStoredName } });
}

async function main() {
  const nursery = await prisma.nursery.findUnique({
    where: { code: 'SABA' },
    include: { locations: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!nursery) throw new Error('Saba nursery was not found');
  const place = nursery.locations[0];
  if (!place) throw new Error('Saba has no place to attach the dummy plants');
  const plotLocation = (place.name.trim() || place.address.trim()).slice(0, 160);

  for (const row of rows) {
    const existing = await prisma.motherPlant.findFirst({
      where: { nurseryId: nursery.id, tagNumber: row.tagNumber },
      include: { photos: true },
    });
    if (existing) {
      for (const photo of existing.photos) {
        if (!sourcePhotos.includes(photo.storedName)) {
          await unlink(path.join(uploadDir, photo.storedName)).catch(() => undefined);
        }
      }
      await prisma.motherPlantPhoto.deleteMany({ where: { motherPlantId: existing.id } });
      await attachPhotos(existing.id);
      console.log(`${row.tagNumber} photos replaced with guava pictures`);
      continue;
    }
    const plant = await prisma.motherPlant.create({
      data: {
        nurseryId: nursery.id,
        tagNumber: row.tagNumber,
        shareCode: shareCode(),
        category: 'FRUIT',
        plantName: 'Guava',
        varietyName: row.varietyName,
        sourceCountry: 'Thailand',
        sourceVendor: 'Chiang Mai Nursery',
        plantingDate: new Date('2026-09-24'),
        plotLocation,
        plantCount: row.plantCount,
        locationId: place.id,
        propagationMethods: ['GRAFTING_SCION'],
        healthStatus: row.healthStatus,
        listPrice: row.listPrice,
        notes: row.notes,
      },
    });
    await attachPhotos(plant.id);
    await attachVideo(plant.id);
    console.log(`${row.tagNumber} ${row.varietyName} x${row.plantCount} at ${plotLocation}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
