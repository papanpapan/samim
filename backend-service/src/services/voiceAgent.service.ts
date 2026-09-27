import { prisma } from '../config/database';
import { currentNurseryId } from './tenantContext';
import { answerNurseryQuestion, detectLang } from './voiceQuery.service';
import {
  isWakeOnlyPhrase,
  normalizeVoiceText,
  parseSpokenNumber,
  resolveLang,
  stripWakePhrase,
} from './voiceNormalize';
import { writeAudit } from './audit.service';
import { ApiError } from '../utils/apiError';
import { env } from '../config/environment';
import { logger } from '../config/logger';

export const VOICE_INTENTS = [
  'query_ask',
  'add_inventory',
  'register_mother',
  'log_scions',
  'greet',
] as const;

export type VoiceIntentName = (typeof VOICE_INTENTS)[number];

export type VoiceIntent = {
  name: VoiceIntentName;
  args: Record<string, string | number | undefined>;
  confidence: number;
};

export type VoicePreview = {
  intent: VoiceIntent;
  summary: string;
  summaryEn: string;
  needsConfirmation: boolean;
  mockLlm: boolean;
  confidence?: number;
  suggestions?: string[];
};

export function greetBoss(lang: 'bn' | 'hi' | 'en', userName?: string) {
  const name = userName?.split(' ')[0] || 'boss';
  if (lang === 'bn') return `জি ${name}, কীভাবে সাহায্য করব?`;
  if (lang === 'hi') return `जी ${name}, मैं कैसे मदद करूँ?`;
  return `Yes ${name}, how can I help you?`;
}

function greetSuggestions(lang: 'bn' | 'hi' | 'en'): string[] {
  if (lang === 'bn') return ['আমের স্টক কত', 'আজকের বিক্রি', 'মাদার কত', 'লো স্টক'];
  if (lang === 'hi') return ['आम स्टॉक', 'आज बिक्री', 'मदर कितने', 'लो स्टॉक'];
  return ['mango stock', 'today sales', 'how many mothers', 'low stock'];
}

function extractPlantHint(q: string): string {
  const aliases: { words: string[]; name: string }[] = [
    { words: ['guava', 'peyara', 'পেয়ারা', 'पेयारा'], name: 'Guava' },
    { words: ['mango', 'aam', 'আম', 'आम'], name: 'Mango' },
    { words: ['jamun', 'জাম', 'जामुन'], name: 'Jamun' },
    {
      words: ['adenium', 'adinium', 'addinium', 'adeneum', 'এডেনিয়াম', 'এডিনিয়াম'],
      name: 'Adenium',
    },
    { words: ['jackfruit', 'kanthal', 'কাঁঠাল'], name: 'Jackfruit' },
  ];
  for (const row of aliases) {
    if (row.words.some((w) => q.includes(w))) return row.name;
  }
  return '';
}

type Scored = { name: VoiceIntentName; score: number; args: Record<string, string | number | undefined> };

/** Score write vs read intents — pick best, require margin for writes. */
export function parseIntentLocal(text: string): VoiceIntent {
  const normalized = normalizeVoiceText(text);
  if (isWakeOnlyPhrase(normalized)) {
    return { name: 'greet', args: { original: normalized }, confidence: 1 };
  }
  const original = stripWakePhrase(normalized) || normalized;
  const q = original.toLowerCase();
  const quantity = parseSpokenNumber(q) ?? undefined;
  const plant = extractPlantHint(q);

  const candidates: Scored[] = [
    { name: 'query_ask', score: 2, args: { original } },
  ];

  let logScore = 0;
  if (/scion|কলম|काट|cutting|harvest|সিয়ন|सायन|সায়ন/.test(q)) logScore += 4;
  if (/(log|add|যোগ|जोड़|কাট|cut|রেকর্ড|record)/.test(q)) logScore += 3;
  if (quantity !== undefined) logScore += 2;
  if (logScore >= 5) {
    candidates.push({
      name: 'log_scions',
      score: logScore,
      args: { quantity: quantity ?? 1, motherHint: plant, original },
    });
  }

  let motherScore = 0;
  if (/register\s*mother|নতুন\s*মাদার|नई\s*मदर|add\s*mother|মাদার\s*(যোগ|বানাও|তৈরি)|create\s*mother/.test(q)) {
    motherScore += 7;
  }
  if (motherScore >= 6) {
    candidates.push({
      name: 'register_mother',
      score: motherScore,
      args: { plantName: plant || 'New plant', original },
    });
  }

  let addScore = 0;
  if (/add\s*(stock|inventory)|স্টক\s*যোগ|स्टॉक\s*जोड़|increase\s*stock|stock\s*বাড়াও/.test(q)) addScore += 7;
  if (addScore >= 6) {
    candidates.push({
      name: 'add_inventory',
      score: addScore,
      args: { delta: quantity ?? 1, plantHint: plant, original },
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0]!;
  const confidence = Math.min(0.99, 0.55 + top.score / 20);
  return { name: top.name, args: top.args, confidence };
}

async function tryLlmParse(text: string): Promise<VoiceIntent | null> {
  const key = env.VOICE_LLM_API_KEY;
  const base = env.VOICE_LLM_BASE_URL;
  if (!key || !base) return null;

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.VOICE_LLM_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'SN-ERMS nursery assistant. JSON only: {"name":"query_ask"|"add_inventory"|"register_mother"|"log_scions"|"greet","args":{},"confidence":0-1}. Prefer query_ask for questions. greet only for hey saba alone.',
          },
          { role: 'user', content: text },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '') as VoiceIntent;
    if (!VOICE_INTENTS.includes(parsed.name)) return null;
    return {
      name: parsed.name,
      args: { ...(parsed.args ?? {}), original: text },
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
    };
  } catch (err) {
    logger.warn('Voice LLM parse failed', { error: err instanceof Error ? err.message : err });
    return null;
  }
}

export async function buildPreview(
  text: string,
  userName?: string,
  preferredLang?: string,
): Promise<VoicePreview> {
  const normalized = normalizeVoiceText(text);
  const llm = await tryLlmParse(normalized);
  const intent = llm ?? parseIntentLocal(normalized);
  const mockLlm = !llm;
  const lang = resolveLang(normalized, preferredLang);

  if (intent.name === 'greet') {
    const summary = greetBoss(lang, userName);
    const suggestions = greetSuggestions(lang);
    const tip =
      lang === 'bn'
        ? `\n\nআপনি জিজ্ঞাসা করতে পারেন: ${suggestions.join(' · ')}।`
        : lang === 'hi'
          ? `\n\nआप पूछ सकते हैं: ${suggestions.join(' · ')}।`
          : `\n\nYou can ask: ${suggestions.join(' · ')}.`;
    return {
      intent,
      summary: `${summary}${tip}`,
      summaryEn: `${greetBoss('en', userName)}\n\nYou can ask: ${greetSuggestions('en').join(' · ')}.`,
      needsConfirmation: false,
      mockLlm,
      confidence: 0.99,
      suggestions,
    };
  }

  if (intent.name === 'query_ask') {
    const original = String(intent.args.original || normalized);
    const voice = await answerNurseryQuestion(original, preferredLang);
    return {
      intent,
      summary: voice.answer,
      summaryEn: voice.answerEn,
      needsConfirmation: false,
      mockLlm,
      confidence: voice.confidence ?? intent.confidence,
      suggestions: voice.suggestions,
    };
  }

  if (intent.name === 'log_scions') {
    const qty = Number(intent.args.quantity) || 1;
    const hint = String(intent.args.motherHint || '');
    const summary =
      lang === 'bn'
        ? `${hint || 'মাদার'} থেকে ${qty} কলম লগ করতে যাচ্ছি। নিশ্চিত করুন।`
        : lang === 'hi'
          ? `${hint || 'मदर'} से ${qty} कलम लॉग होगा। पुष्टि करें।`
          : `Log ${qty} scion(s) on ${hint || 'selected mother'}. Confirm?`;
    return {
      intent: { ...intent, args: { ...intent.args, quantity: qty } },
      summary,
      summaryEn: `Log ${qty} scion(s) on ${hint || 'selected mother'}. Confirm?`,
      needsConfirmation: true,
      mockLlm,
      confidence: intent.confidence,
    };
  }

  if (intent.name === 'add_inventory') {
    const delta = Number(intent.args.delta) || 1;
    const hint = String(intent.args.plantHint || '');
    const summary =
      lang === 'bn'
        ? `${hint || 'স্টক'} এ ${delta} যোগ করতে চাই। নিশ্চিত করুন।`
        : `Add ${delta} to ${hint || 'inventory'}. Confirm?`;
    return {
      intent: { ...intent, args: { ...intent.args, delta } },
      summary,
      summaryEn: `Add ${delta} to ${hint || 'inventory'}. Confirm?`,
      needsConfirmation: true,
      mockLlm,
      confidence: intent.confidence,
    };
  }

  const plantName = String(intent.args.plantName || 'New plant');
  return {
    intent,
    summary:
      lang === 'bn'
        ? `নতুন মাদার "${plantName}" রেজিস্টারের খসড়া। নিশ্চিত করলে Mother Plants খুলবে।`
        : `Draft register mother "${plantName}". Confirm to open Mother Plants.`,
    summaryEn: `Draft register mother "${plantName}". Confirm to open Mother Plants.`,
    needsConfirmation: true,
    mockLlm,
    confidence: intent.confidence,
  };
}

export async function executeIntent(intent: VoiceIntent, userId: string, userName?: string) {
  const nurseryId = currentNurseryId();
  if (!nurseryId && intent.name !== 'greet') throw ApiError.badRequest('Nursery context required');

  if (intent.name === 'greet') {
    const lang = detectLang(String(intent.args.original || ''));
    const answer = greetBoss(lang, userName);
    return { answer, answerEn: greetBoss('en', userName), kind: 'greet' as const };
  }

  if (intent.name === 'query_ask') {
    return answerNurseryQuestion(String(intent.args.original || 'summary today'));
  }

  if (intent.name === 'log_scions') {
    const qty = Number(intent.args.quantity) || 1;
    const hint = String(intent.args.motherHint || '').toLowerCase();
    const mothers = await prisma.motherPlant.findMany({ orderBy: { createdAt: 'desc' }, take: 60 });
    const mother =
      (hint
        ? mothers.find(
            (m) =>
              m.plantName.toLowerCase().includes(hint) ||
              m.varietyName.toLowerCase().includes(hint) ||
              m.tagNumber.toLowerCase().includes(hint),
          )
        : null) ?? null;
    if (!mother) {
      throw ApiError.notFound(
        hint
          ? `No mother matching "${hint}". Say the plant name or tag.`
          : 'No mother plant found. Name the mother plant first.',
      );
    }
    const updated = await prisma.motherPlant.update({
      where: { id: mother.id },
      data: { scionsHarvested: { increment: qty } },
    });
    await writeAudit(userId, 'VOICE_LOG_SCIONS', 'MotherPlant', mother.id, {
      quantity: qty,
      source: 'voice-agent',
    }).catch(() => undefined);
    return {
      answer: `Logged ${qty} scion(s) on ${updated.tagNumber} (${updated.plantName}). Total ${updated.scionsHarvested}.`,
      answerEn: `Logged ${qty} scion(s) on ${updated.tagNumber}.`,
      kind: 'log_scions' as const,
      motherId: updated.id,
      quantity: qty,
    };
  }

  if (intent.name === 'add_inventory') {
    const delta = Number(intent.args.delta) || 1;
    const hint = String(intent.args.plantHint || '').toLowerCase();
    const plants = await prisma.plantInventory.findMany({ orderBy: { commonName: 'asc' }, take: 100 });
    const plant = hint
      ? plants.find(
          (p) =>
            p.commonName.toLowerCase().includes(hint) ||
            p.sku.toLowerCase().includes(hint) ||
            p.variety.toLowerCase().includes(hint),
        )
      : null;
    if (!plant) {
      throw ApiError.notFound(
        hint
          ? `No inventory row matching "${hint}".`
          : 'Name the plant/SKU to add stock.',
      );
    }
    const updated = await prisma.plantInventory.update({
      where: { id: plant.id },
      data: { currentStock: { increment: delta } },
    });
    return {
      answer: `Added ${delta} to ${updated.sku} (${updated.commonName}). Stock now ${updated.currentStock}.`,
      answerEn: `Added ${delta} to ${updated.sku}. Stock ${updated.currentStock}.`,
      kind: 'add_inventory' as const,
      plantId: updated.id,
      quantity: updated.currentStock,
    };
  }

  return {
    answer: 'Open Mother Plants to finish registration with place and photos.',
    answerEn: 'Open Mother Plants to finish registration with place and photos.',
    kind: 'register_mother' as const,
    plantName: String(intent.args.plantName || 'New plant'),
    navigateTo: '/mother-plants',
  };
}
