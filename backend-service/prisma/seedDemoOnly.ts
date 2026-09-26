import { PrismaClient } from '@prisma/client';
import { seedDemoMothers } from './demoMothers';

const prisma = new PrismaClient();

async function main() {
  const codes = ['SABA', 'ABCDNURC-X3JO'];
  for (const code of codes) {
    const nursery = await prisma.nursery.findUnique({ where: { code } });
    if (!nursery) continue;
    const prefix = code === 'SABA' ? 'demo50' : 'abdemo';
    const count = await seedDemoMothers(prisma, nursery.id, prefix);
    console.log(`${nursery.name}: ${count} demo mother plants`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
