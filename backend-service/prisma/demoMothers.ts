import type { PrismaClient } from '@prisma/client';

const GROUPS: { plant: string; category: string; varieties: string[] }[] = [
  { plant: 'Guava', category: 'FRUIT', varieties: ['Crystal Guava', 'Taiwan Pink Guava', 'White Giant Guava', 'Apple Guava', 'Lemon Guava'] },
  { plant: 'Mango', category: 'FRUIT', varieties: ['Alphonso', 'Kesar', 'Langra', 'Himsagar', 'Dasheri'] },
  { plant: 'Jamun', category: 'FRUIT', varieties: ['Black Pearl Jamun', 'Ra Jamun', 'Seedless Jamun', 'Konkan Bahadoli', 'Goma Priyanka'] },
  { plant: 'Jackfruit', category: 'FRUIT', varieties: ['Vietnam Super Early', 'Red Flesh Jackfruit', 'Gumless Jackfruit', 'Singapore Jackfruit', 'Ceylon Jack'] },
  { plant: 'Lemon', category: 'FRUIT', varieties: ['Kagzi Lemon', 'Seedless Lemon', 'Eureka Lemon', 'Meyer Lemon', 'Assam Lemon'] },
  { plant: 'Dragon Fruit', category: 'EXOTIC', varieties: ['Red Dragon Fruit', 'White Dragon Fruit', 'Yellow Dragon Fruit', 'American Beauty', 'Dark Star'] },
  { plant: 'Adenium', category: 'FLOWERING', varieties: ['Black Fairy', 'Golden Crown', 'Pink Butterfly', 'Desert Rose', 'Thai Socotranum'] },
  { plant: 'Hibiscus', category: 'FLOWERING', varieties: ['Double Red Hibiscus', 'Peach Glow Hibiscus', 'Blue Bird Hibiscus', 'White Wings Hibiscus', 'Orange Splash Hibiscus'] },
  { plant: 'Aglaonema', category: 'FOLIAGE', varieties: ['Silver Queen', 'Red Siam', 'Pink Dalmatian', 'Emerald Beauty', 'Golden Bay'] },
  { plant: 'Tulsi', category: 'MEDICINAL', varieties: ['Rama Tulsi', 'Krishna Tulsi', 'Vana Tulsi', 'Kapoor Tulsi', 'Thai Holy Basil'] },
];

const COUNTRIES = ['Thailand', 'Vietnam', 'Malaysia', 'India'];
const VENDORS = ['Thai Nursery', 'Mekong Plants', 'KL Orchard', ''];
const HEALTH = ['HEALTHY', 'FLOWERING', 'FRUITING', 'DORMANT', 'NEEDS_CARE'];
const METHODS = ['GRAFTING_SCION', 'AIR_LAYERING', 'CUTTING', 'TISSUE_CULTURE'];
const BLOCKS = ['A', 'B', 'C', 'D', 'E'];

export async function seedDemoMothers(prisma: PrismaClient, nurseryId: string, sharePrefix = 'demo50') {
  let index = 0;
  for (const group of GROUPS) {
    for (const variety of group.varieties) {
      index += 1;
      const tagNumber = `MP-DEMO-${String(index).padStart(2, '0')}`;
      const planted = new Date(2022, 0, 8);
      planted.setDate(planted.getDate() + index * 18);
      const methods = index % 3 === 0 ? [METHODS[index % METHODS.length], METHODS[(index + 1) % METHODS.length]] : [METHODS[index % METHODS.length]];
      await prisma.motherPlant.upsert({
        where: { nurseryId_tagNumber: { nurseryId, tagNumber } },
        update: {},
        create: {
          nurseryId,
          tagNumber,
          category: group.category,
          plantName: group.plant,
          varietyName: variety,
          sourceCountry: COUNTRIES[index % COUNTRIES.length],
          sourceVendor: VENDORS[index % VENDORS.length] || null,
          plantingDate: planted,
          plotLocation: `Block ${BLOCKS[index % BLOCKS.length]}, Bed ${(index % 12) + 1}, Plant ${(index % 8) + 1}`,
          propagationMethods: methods,
          healthStatus: HEALTH[index % HEALTH.length],
          seasonCapacity: index % 7 === 0 ? null : 24 + (index % 9) * 12,
          listPrice: index % 5 === 0 ? null : 120 + index * 35,
          shareCode: `${sharePrefix}${String(index).padStart(2, '0')}`,
          scionsHarvested: (index * 17) % 280,
          notes: index % 4 === 0 ? null : `${variety} mother tree kept for propagation trials.`,
        },
      });
    }
  }
  return index;
}
