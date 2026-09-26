import { prisma } from '../config/database';
import { currentNurseryId } from './tenantContext';

const ALIASES: { words: string[]; name: string }[] = [
  { words: ['peyara', 'পেয়ারা', 'পেয়ারা', 'guava', 'diamond'], name: 'Guava' },
  { words: ['jamun', 'জাম', 'jam'], name: 'Jamun' },
  { words: ['jackfruit', 'কাঁঠাল', 'kanthal'], name: 'Jackfruit' },
  { words: ['adenium', 'এডেনিয়াম'], name: 'Adenium' },
  { words: ['mulberry', 'তুঁত', 'তুত'], name: 'Mulberry' },
  { words: ['blackberry'], name: 'Blackberry' },
  { words: ['blueberry'], name: 'Blueberry' },
];

function hasBangla(text: string) {
  return /[\u0980-\u09FF]/.test(text);
}

function wantsSales(text: string) {
  return /sell|sold|sales|বিক্রি|বিক্রয়|বিক্রয়/.test(text);
}

function plantHint(text: string) {
  const lower = text.toLowerCase();
  const alias = ALIASES.find((row) => row.words.some((word) => lower.includes(word)));
  return alias?.name ?? '';
}

function moneySymbol(currencyCode: string) {
  return currencyCode === 'INR' ? '₹' : '৳';
}

export async function answerVoice(text: string) {
  const query = text.trim();
  const bangla = hasBangla(query);
  const sales = wantsSales(query);
  const hint = plantHint(query);
  const nurseryId = currentNurseryId();
  const nursery = nurseryId
    ? await prisma.nursery.findUnique({ where: { id: nurseryId }, select: { currencyCode: true } })
    : null;
  const symbol = moneySymbol(nursery?.currencyCode === 'INR' ? 'INR' : 'BDT');
  const plants = await prisma.plantInventory.findMany({ orderBy: { commonName: 'asc' } });
  const matched = hint
    ? plants.filter((plant) => plant.commonName.toLowerCase().includes(hint.toLowerCase()))
    : plants;

  if (sales) {
    const since = /today|আজ/.test(query.toLowerCase())
      ? new Date(new Date().setHours(0, 0, 0, 0))
      : null;
    const rows = await prisma.sale.findMany({
      where: since ? { createdAt: { gte: since } } : undefined,
      include: { items: { include: { plant: true } } },
    });
    let qty = 0;
    let value = 0;
    for (const sale of rows) {
      for (const item of sale.items) {
        if (hint && !item.plant.commonName.toLowerCase().includes(hint.toLowerCase())) continue;
        qty += item.quantity;
        value += Number(item.itemTotalPrice);
      }
    }
    const label = hint || (bangla ? 'সব গাছ' : 'all plants');
    const when = since ? (bangla ? 'আজ' : 'today') : bangla ? 'মোট' : 'in total';
    const amount = `${symbol}${value.toLocaleString('en-IN')}`;
    const answer = bangla
      ? `${label}: ${when} ${qty} টি বিক্রি, ${amount}।`
      : `${label}: ${when} ${qty} sold, ${amount}.`;
    const answerEn = `${label}: ${since ? 'today' : 'in total'} ${qty} sold, ${amount}.`;
    return { answer, answerEn, kind: 'sales' as const, quantity: qty, value };
  }

  const stock = matched.reduce((sum, plant) => sum + plant.currentStock, 0);
  const names = matched.slice(0, 4).map((plant) => `${plant.commonName} ${plant.currentStock}`).join(', ');
  const answer = bangla
    ? hint
      ? `${hint} স্টক ${stock} টি। ${names}`
      : `মোট স্টক ${stock} টি। ${names}`
    : hint
      ? `${hint} stock is ${stock}. ${names}`
      : `Total stock is ${stock}. ${names}`;
  const answerEn = hint ? `${hint} stock is ${stock}. ${names}` : `Total stock is ${stock}. ${names}`;
  return { answer, answerEn, kind: 'stock' as const, quantity: stock, value: 0 };
}
