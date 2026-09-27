import { prisma } from '../config/database';
import { currentNurseryId } from './tenantContext';
import { bestTopic, normalizeVoiceText, parseSpokenNumber, resolveLang } from './voiceNormalize';

const ALIASES: { words: string[]; name: string }[] = [
  { words: ['peyara', 'পেয়ারা', 'পেয়ারা', 'guava', 'diamond'], name: 'Guava' },
  { words: ['mango', 'aam', 'আম', 'आम'], name: 'Mango' },
  { words: ['jamun', 'জাম', 'jam', 'जामुन'], name: 'Jamun' },
  { words: ['jackfruit', 'কাঁঠাল', 'kanthal'], name: 'Jackfruit' },
  {
    words: ['adenium', 'adinium', 'addinium', 'adeneum', 'adeniam', 'এডেনিয়াম', 'এডিনিয়াম'],
    name: 'Adenium',
  },
  { words: ['mulberry', 'তুঁত', 'তুত'], name: 'Mulberry' },
  { words: ['blackberry'], name: 'Blackberry' },
  { words: ['blueberry'], name: 'Blueberry' },
];

export type VoiceAnswer = {
  answer: string;
  answerEn: string;
  kind: string;
  quantity: number;
  value: number;
  confidence: number;
  suggestions: string[];
};

function nextAsks(lang: LangTone, kind: string, hint?: string): string[] {
  const plant = hint || pick(lang, 'আম', 'mango', 'आम');
  const sets: Record<string, { bn: string[]; en: string[]; hi: string[] }> = {
    stock: {
      bn: [`আজকের বিক্রি`, `${plant} দাম`, 'লো স্টক', 'মাদার কত'],
      en: [`today sales`, `${plant} price`, 'low stock', 'how many mothers'],
      hi: ['आज बिक्री', `${plant} दाम`, 'लो स्टॉक', 'मदर कितने'],
    },
    sales: {
      bn: ['আজ স্টক কত', 'লো স্টক', 'সারাংশ'],
      en: ['today stock', 'low stock', 'nursery summary'],
      hi: ['आज स्टॉक', 'लो स्टॉक', 'सारांश'],
    },
    mothers: {
      bn: ['স্টক কত', 'কেয়ার বাকি', 'ব্যাচ কত'],
      en: ['stock count', 'pending care', 'open batches'],
      hi: ['स्टॉक कितना', 'बाकी केयर', 'खुले बैच'],
    },
    batches: {
      bn: ['স্টক', 'মাদার', 'কেয়ার'],
      en: ['stock', 'mothers', 'care tasks'],
      hi: ['स्टॉक', 'मदर', 'केयर'],
    },
    care: {
      bn: ['অ্যালার্ট', 'লো স্টক', 'আজকের বিক্রি'],
      en: ['open alerts', 'low stock', 'today sales'],
      hi: ['अलर्ट', 'लो स्टॉक', 'आज बिक्री'],
    },
    alerts: {
      bn: ['কেয়ার', 'লো স্টক', 'সারাংশ'],
      en: ['pending care', 'low stock', 'summary'],
      hi: ['केयर', 'लो स्टॉक', 'सारांश'],
    },
    low_stock: {
      bn: [`${plant} স্টক`, 'আজকের বিক্রি', 'দাম'],
      en: [`${plant} stock`, 'today sales', 'price'],
      hi: [`${plant} स्टॉक`, 'आज बिक्री', 'दाम'],
    },
    price: {
      bn: [`${plant} স্টক`, 'আজকের বিক্রি', 'লো স্টক'],
      en: [`${plant} stock`, 'today sales', 'low stock'],
      hi: [`${plant} स्टॉक`, 'आज बिक्री', 'लो स्टॉक'],
    },
    summary: {
      bn: ['স্টক', 'আজকের বিক্রি', 'মাদার', 'অ্যালার্ট'],
      en: ['stock', 'today sales', 'mothers', 'alerts'],
      hi: ['स्टॉक', 'आज बिक्री', 'मदर', 'अलर्ट'],
    },
    help: {
      bn: ['আমের স্টক', 'আজকের বিক্রি', 'মাদার কত'],
      en: ['mango stock', 'today sales', 'how many mothers'],
      hi: ['आम स्टॉक', 'आज बिक्री', 'मदर कितने'],
    },
    staff: {
      bn: ['সারাংশ', 'স্টক', 'সাহায্য'],
      en: ['summary', 'stock', 'help'],
      hi: ['सारांश', 'स्टॉक', 'मदद'],
    },
    clarify: {
      bn: ['আমের স্টক কত', 'আজকের বিক্রি', 'সাহায্য'],
      en: ['mango stock', 'today sales', 'help'],
      hi: ['आम स्टॉक', 'आज बिक्री', 'मदद'],
    },
  };
  const row = sets[kind] ?? sets.clarify!;
  return lang === 'bn' ? row.bn : lang === 'hi' ? row.hi : row.en;
}

function finalize(
  lang: LangTone,
  base: Omit<VoiceAnswer, 'suggestions'>,
  hint?: string,
): VoiceAnswer {
  const suggestions = nextAsks(lang, base.kind, hint);
  if (suggestions.length === 0) return { ...base, suggestions: [] };
  const tip = pick(
    lang,
    `\n\nআপনি আরও জিজ্ঞাসা করতে পারেন: ${suggestions.join(' · ')}।`,
    `\n\nYou can also ask: ${suggestions.join(' · ')}.`,
    `\n\nआप और पूछ सकते हैं: ${suggestions.join(' · ')}।`,
  );
  return {
    ...base,
    answer: `${base.answer}${tip}`,
    answerEn: `${base.answerEn}${tip}`,
    suggestions,
  };
}

export type LangTone = 'bn' | 'hi' | 'en';

export function detectLang(text: string): LangTone {
  if (/[\u0980-\u09FF]/.test(text)) return 'bn';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  return 'en';
}

function moneySymbol(currencyCode: string) {
  return currencyCode === 'INR' ? '₹' : '৳';
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function pick(lang: LangTone, bn: string, en: string, hi: string) {
  if (lang === 'bn') return bn;
  if (lang === 'hi') return hi;
  return en;
}

async function resolvePlantHint(text: string): Promise<string> {
  const lower = text.toLowerCase();
  const alias = ALIASES.find((row) => row.words.some((word) => lower.includes(word.toLowerCase())));
  if (alias) return alias.name;

  const [plants, mothers] = await Promise.all([
    prisma.plantInventory.findMany({
      select: { commonName: true, variety: true, sku: true },
      take: 200,
    }),
    prisma.motherPlant.findMany({
      select: { plantName: true, varietyName: true, tagNumber: true },
      take: 100,
    }),
  ]);

  let best = '';
  let bestLen = 0;
  const consider = (label: string) => {
    const l = label.trim();
    if (l.length < 3) return;
    if (lower.includes(l.toLowerCase()) && l.length > bestLen) {
      best = l;
      bestLen = l.length;
    }
  };
  for (const p of plants) {
    consider(p.commonName);
    consider(p.variety);
    consider(p.sku);
  }
  for (const m of mothers) {
    consider(m.plantName);
    consider(m.varietyName);
    consider(m.tagNumber);
  }
  return best;
}

function matchPlants<T extends { commonName: string; variety: string; sku: string }>(plants: T[], hint: string) {
  if (!hint) return plants;
  const h = hint.toLowerCase();
  return plants.filter(
    (p) =>
      p.commonName.toLowerCase().includes(h) ||
      p.variety.toLowerCase().includes(h) ||
      p.sku.toLowerCase().includes(h) ||
      h.includes(p.commonName.toLowerCase().slice(0, 8)),
  );
}

/** Rich nursery Q&A for the logged-in tenant (read-only). */
export async function answerNurseryQuestion(text: string, preferredLang?: string) {
  const query = normalizeVoiceText(text);
  const lang = resolveLang(query, preferredLang);
  const q = query.toLowerCase();
  const hint = await resolvePlantHint(query);
  const { topic, score, ambiguous } = bestTopic(q);

  const nurseryId = currentNurseryId();
  const nursery = nurseryId
    ? await prisma.nursery.findUnique({
        where: { id: nurseryId },
        select: { name: true, code: true, currencyCode: true, city: true, plan: true },
      })
    : null;
  const symbol = moneySymbol(nursery?.currencyCode === 'INR' ? 'INR' : 'BDT');
  const nurseryLabel = nursery?.name ?? (lang === 'bn' ? 'এই নার্সারি' : lang === 'hi' ? 'यह नर्सरी' : 'this nursery');

  if (ambiguous || score < 2) {
    const answer = pick(
      lang,
      `বুঝতে একটু অস্পষ্ট। বলুন: স্টক, আজকের বিক্রি, মাদার, ব্যাচ, কেয়ার, অ্যালার্ট, লো-স্টক, বা সাহায্য। উদাহরণ: "আমের স্টক কত"।`,
      `I am not sure yet. Try: stock, today sales, mothers, batches, care, alerts, low stock, or help. Example: "mango stock".`,
      `साफ़ नहीं समझा। कहें: स्टॉक, आज बिक्री, मदर, बैच, केयर, अलर्ट, लो-स्टॉक, या मदद।`,
    );
    return finalize(lang, { answer, answerEn: answer, kind: 'clarify', quantity: 0, value: 0, confidence: score / 10 });
  }

  if (topic === 'help') {
    const answer = pick(
      lang,
      `${nurseryLabel}-এ: Today, Field Hub, Mother Plants, Propagation, Inventory, POS, Care, Alerts, Staff & Team। জিজ্ঞাসা: স্টক / বিক্রি / মাদার / ব্যাচ / কেয়ার / অ্যালার্ট।`,
      `${nurseryLabel}: Today, Field Hub, Mother Plants, Propagation, Inventory, POS, Care, Alerts, Staff & Team. Ask stock, sales, mothers, batches, care, alerts.`,
      `${nurseryLabel}: Today, Field Hub, Mother, Propagation, Inventory, POS, Care, Alerts। स्टॉक/बिक्री/मदर पूछें।`,
    );
    return finalize(lang, { answer, answerEn: answer, kind: 'help', quantity: 0, value: 0, confidence: 0.95 });
  }

  if (topic === 'summary') {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const [mothers, batches, plants, salesToday, care, alerts, low] = await Promise.all([
      prisma.motherPlant.count(),
      prisma.propagationBatch.count({ where: { stage: { not: 'CLOSED' } } }),
      prisma.plantInventory.findMany({ select: { currentStock: true } }),
      prisma.sale.findMany({ where: { createdAt: { gte: startOfToday() } }, select: { netTotal: true } }),
      prisma.careSchedule.count({ where: { status: 'PENDING', scheduledOn: { lte: end } } }),
      prisma.dangerAlert.count({ where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } } }),
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*)::bigint AS count FROM "PlantInventory"
        WHERE "currentStock" <= "reorderAlert"`,
    ]);
    const units = plants.reduce((s, p) => s + p.currentStock, 0);
    const salesVal = salesToday.reduce((s, row) => s + Number(row.netTotal), 0);
    const lowN = Number(low[0]?.count ?? 0);
    const answer = pick(
      lang,
      `${nurseryLabel}: মাদার ${mothers}, ব্যাচ ${batches}, স্টক ${units}, আজ বিক্রি ${symbol}${salesVal.toLocaleString('en-IN')} (${salesToday.length} বিল), কেয়ার ${care}, অ্যালার্ট ${alerts}, লো-স্টক ${lowN}।`,
      `${nurseryLabel}: mothers ${mothers}, batches ${batches}, stock ${units}, today sales ${symbol}${salesVal.toLocaleString('en-IN')} (${salesToday.length} bills), care ${care}, alerts ${alerts}, low-stock ${lowN}.`,
      `${nurseryLabel}: मदर ${mothers}, बैच ${batches}, स्टॉक ${units}, आज बिक्री ${symbol}${salesVal.toLocaleString('en-IN')}, केयर ${care}, अलर्ट ${alerts}, लो-स्टॉक ${lowN}.`,
    );
    return finalize(lang, { answer, answerEn: answer, kind: 'summary', quantity: units, value: salesVal, confidence: 0.95 });
  }

  if (topic === 'mothers') {
    const mothers = await prisma.motherPlant.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { tagNumber: true, plantName: true, varietyName: true, healthStatus: true, scionsHarvested: true },
    });
    const matched = hint
      ? mothers.filter(
          (m) =>
            m.plantName.toLowerCase().includes(hint.toLowerCase()) ||
            m.varietyName.toLowerCase().includes(hint.toLowerCase()) ||
            m.tagNumber.toLowerCase().includes(hint.toLowerCase()),
        )
      : mothers;
    const unhealthy = matched.filter((m) => m.healthStatus !== 'HEALTHY').length;
    const sample = matched
      .slice(0, 5)
      .map((m) => `${m.tagNumber} ${m.plantName} (কলম ${m.scionsHarvested})`)
      .join('; ');
    const answer = pick(
      lang,
      `মাদার ${matched.length}টি${hint ? ` · ${hint}` : ''}। অস্বাস্থ্য ${unhealthy}। ${sample || 'নেই'}।`,
      `Mothers: ${matched.length}${hint ? ` · ${hint}` : ''}. Unhealthy: ${unhealthy}. ${sample || 'none'}.`,
      `मदर ${matched.length}${hint ? ` · ${hint}` : ''}। अस्वस्थ ${unhealthy}। ${sample || 'नहीं'}।`,
    );
    return finalize(lang, { answer, answerEn: answer, kind: 'mothers', quantity: matched.length, value: 0, confidence: 0.93 }, hint);
  }

  if (topic === 'batches') {
    const batches = await prisma.propagationBatch.findMany({
      where: { stage: { not: 'CLOSED' } },
      orderBy: { startDate: 'desc' },
      take: 40,
      select: { batchCode: true, stage: true, currentQuantity: true },
    });
    const byStage = batches.reduce<Record<string, number>>((acc, b) => {
      acc[b.stage] = (acc[b.stage] ?? 0) + 1;
      return acc;
    }, {});
    const stageText = Object.entries(byStage)
      .map(([k, v]) => `${k}:${v}`)
      .join(', ');
    const sample = batches
      .slice(0, 4)
      .map((b) => `${b.batchCode} ${b.stage}×${b.currentQuantity}`)
      .join('; ');
    const answer = pick(
      lang,
      `খোলা ব্যাচ ${batches.length}। ধাপ: ${stageText || 'নেই'}। ${sample || ''}।`,
      `Open batches ${batches.length}. Stages: ${stageText || 'none'}. ${sample || ''}.`,
      `खुले बैच ${batches.length}। चरण: ${stageText || 'नहीं'}। ${sample || ''}।`,
    );
    return finalize(lang, { answer, answerEn: answer, kind: 'batches', quantity: batches.length, value: 0, confidence: 0.93 });
  }

  if (topic === 'care') {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const tasks = await prisma.careSchedule.findMany({
      where: { status: 'PENDING', scheduledOn: { lte: end } },
      take: 20,
      include: { plant: { select: { commonName: true, sku: true } } },
      orderBy: { scheduledOn: 'asc' },
    });
    const sample = tasks
      .slice(0, 5)
      .map((row) => `${row.taskType} → ${row.plant.commonName}`)
      .join('; ');
    const answer = pick(
      lang,
      `বাকি কেয়ার ${tasks.length}। ${sample || 'সব শেষ।'} Field Hub থেকে টিক দিন।`,
      `Pending care: ${tasks.length}. ${sample || 'All clear.'} Mark done in Field Hub.`,
      `बाकी केयर ${tasks.length}। ${sample || 'सब पूरा।'}`,
    );
    return finalize(lang, { answer, answerEn: answer, kind: 'care', quantity: tasks.length, value: 0, confidence: 0.93 });
  }

  if (topic === 'alerts') {
    const open = await prisma.dangerAlert.findMany({
      where: { status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
      orderBy: { raisedAt: 'desc' },
      take: 10,
      select: { kind: true, severity: true, status: true, caseNo: true },
    });
    const sample = open.map((a) => `${a.caseNo} ${a.kind} ${a.status}`).join('; ');
    const answer = pick(
      lang,
      `খোলা অ্যালার্ট ${open.length}। ${sample || 'কোনো খোলা কেস নেই।'}`,
      `Open alerts: ${open.length}. ${sample || 'None open.'}`,
      `खुली अलर्ट ${open.length}। ${sample || 'कोई नहीं।'}`,
    );
    return finalize(lang, { answer, answerEn: answer, kind: 'alerts', quantity: open.length, value: 0, confidence: 0.93 });
  }

  if (topic === 'low_stock') {
    const plants = await prisma.plantInventory.findMany({
      orderBy: { commonName: 'asc' },
      select: { sku: true, commonName: true, currentStock: true, reorderAlert: true, variety: true },
    });
    const low = matchPlants(plants, hint).filter((p) => p.currentStock <= p.reorderAlert);
    const allLow = hint ? low : plants.filter((p) => p.currentStock <= p.reorderAlert);
    const sample = allLow
      .slice(0, 6)
      .map((p) => `${p.commonName} ${p.currentStock}/${p.reorderAlert}`)
      .join('; ');
    const answer = pick(
      lang,
      `লো-স্টক ${allLow.length}টি। ${sample || 'সব ঠিক।'}`,
      `Low-stock SKUs: ${allLow.length}. ${sample || 'All fine.'}`,
      `लो-स्टॉक ${allLow.length}। ${sample || 'सब ठीक।'}`,
    );
    return finalize(lang, { answer, answerEn: answer, kind: 'low_stock', quantity: allLow.length, value: 0, confidence: 0.94 }, hint);
  }

  if (topic === 'sales') {
    const since = /today|আজ|आज/.test(q) ? startOfToday() : null;
    const rows = await prisma.sale.findMany({
      where: since ? { createdAt: { gte: since } } : undefined,
      include: { items: { include: { plant: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    let qty = 0;
    let value = 0;
    for (const sale of rows) {
      for (const item of sale.items) {
        if (
          hint &&
          !item.plant.commonName.toLowerCase().includes(hint.toLowerCase()) &&
          !item.plant.variety.toLowerCase().includes(hint.toLowerCase())
        ) {
          continue;
        }
        qty += item.quantity;
        value += Number(item.itemTotalPrice);
      }
    }
    const label = hint || pick(lang, 'সব গাছ', 'all plants', 'सभी');
    const when = since ? pick(lang, 'আজ', 'today', 'आज') : pick(lang, 'মোট', 'total', 'कुल');
    const amount = `${symbol}${value.toLocaleString('en-IN')}`;
    const answer = pick(
      lang,
      `${label}: ${when} ${qty} টি, ${amount} (${rows.length} বিল)।`,
      `${label}: ${when} ${qty} sold, ${amount} (${rows.length} bills).`,
      `${label}: ${when} ${qty}, ${amount} (${rows.length} बिल)।`,
    );
    return finalize(lang, { answer, answerEn: answer, kind: 'sales', quantity: qty, value, confidence: 0.95 }, hint);
  }

  if (topic === 'staff') {
    const users = await prisma.user.count({
      where: nurseryId ? { nurseryId } : undefined,
    });
    const answer = pick(
      lang,
      `${nurseryLabel}-এ ইউজার ~${users}। Staff & Team / My nursery থেকে যোগ করুন।`,
      `${nurseryLabel} has ~${users} users. Add via Staff & Team or My nursery.`,
      `${nurseryLabel} में ~${users} यूज़र।`,
    );
    return finalize(lang, { answer, answerEn: answer, kind: 'staff', quantity: users, value: 0, confidence: 0.9 });
  }

  if (topic === 'price') {
    const plants = await prisma.plantInventory.findMany({
      orderBy: { commonName: 'asc' },
      take: 80,
      select: { commonName: true, variety: true, sku: true, retailPrice: true, wholesalePrice: true, currentStock: true },
    });
    const matched = matchPlants(plants, hint).slice(0, 5);
    if (matched.length === 0) {
      const answer = pick(lang, 'দামের মিল পাইনি। গাছের নাম বলুন।', 'No price match. Name a plant.', 'दाम नहीं मिला।');
      return finalize(lang, { answer, answerEn: answer, kind: 'price', quantity: 0, value: 0, confidence: 0.7 }, hint);
    }
    const sample = matched
      .map(
        (p) =>
          `${p.commonName}: retail ${symbol}${Number(p.retailPrice).toLocaleString('en-IN')}, wholesale ${symbol}${Number(p.wholesalePrice).toLocaleString('en-IN')} (stock ${p.currentStock})`,
      )
      .join('; ');
    return finalize(
      lang,
      { answer: sample, answerEn: sample, kind: 'price', quantity: matched.length, value: 0, confidence: 0.92 },
      hint,
    );
  }

  // stock (default high-confidence topic)
  const plants = await prisma.plantInventory.findMany({ orderBy: { commonName: 'asc' } });
  const matched = matchPlants(plants, hint);
  const stock = matched.reduce((sum, plant) => sum + plant.currentStock, 0);
  const names = matched
    .slice(0, 5)
    .map((plant) => `${plant.commonName} ${plant.currentStock}`)
    .join(', ');
  const answer = pick(
    lang,
    hint
      ? `আজ ${hint} স্টক আছে ${stock}টি। ${names ? `বিস্তারিত: ${names}।` : 'মিল পাইনি।'}`
      : `আজ মোট স্টক আছে ${stock}টি (${matched.length} SKU)। ${names}`,
    hint
      ? `Today ${hint} stock is ${stock}. ${names ? `Details: ${names}.` : 'No match.'}`
      : `Today sellable stock is ${stock} across ${matched.length} SKUs. ${names}`,
    hint
      ? `आज ${hint} स्टॉक ${stock} है। ${names ? `विवरण: ${names}।` : 'मैच नहीं।'}`
      : `आज कुल स्टॉक ${stock} (${matched.length} SKU)। ${names}`,
  );
  return finalize(
    lang,
    {
      answer,
      answerEn: answer,
      kind: 'stock',
      quantity: stock,
      value: 0,
      confidence: hint ? 0.94 : 0.88,
    },
    hint,
  );
}

export async function answerVoice(text: string) {
  return answerNurseryQuestion(text);
}

export { parseSpokenNumber, normalizeVoiceText };
