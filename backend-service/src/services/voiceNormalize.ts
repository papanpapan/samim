/** Speech / chat text normalization for higher intent accuracy. */

const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  fifty: 50,
  hundred: 100,
  ek: 1,
  dui: 2,
  tin: 3,
  char: 4,
  panch: 5,
  chhoy: 6,
  sat: 7,
  at: 8,
  noy: 9,
  dosh: 10,
  এক: 1,
  দুই: 2,
  তিন: 3,
  চার: 4,
  পাঁচ: 5,
  পাচ: 5,
  ছয়: 6,
  ছয়টা: 6,
  সাত: 7,
  আট: 8,
  নয়: 9,
  দশ: 10,
  एक: 1,
  दो: 2,
  तीन: 3,
  चार: 4,
  पांच: 5,
  छह: 6,
  सात: 7,
  आठ: 8,
  नौ: 9,
  दस: 10,
};

const ASR_FIXES: [RegExp, string][] = [
  [/\bhey\s*sab[aehàá]?\b/gi, 'hey saba'],
  [/\bhi\s*sab[aeh]?\b/gi, 'hi saba'],
  [/\bhello\s*sab[aeh]?\b/gi, 'hello saba'],
  [/\bsabba\b/gi, 'saba'],
  // English ASR / typos
  [/\bstalk\b/gi, 'stock'],
  [/\bstoke\b/gi, 'stock'],
  [/\bstok\b/gi, 'stock'],
  [/\bstuk\b/gi, 'stock'],
  [/\bstoc\b/gi, 'stock'],
  [/\badin+i+um\b/gi, 'adenium'],
  [/\badeneum\b/gi, 'adenium'],
  [/\badeniam\b/gi, 'adenium'],
  [/\bpeyara\b/gi, 'guava'],
  [/\baam\b/gi, 'mango'],
  [/\bkanthal\b/gi, 'jackfruit'],
  // Romanized Bangla / Hindi (user typed voice)
  [/\b(ajj|aaj|aajke|ajke|ajker|aajker)\b/gi, 'today'],
  [/\b(koto|kotogula|kotogulo|koyta|koita)\b/gi, 'how many'],
  [/\b(bikri|bikry|bickri)\b/gi, 'sales'],
  [/\b(dam|daam)\b/gi, 'price'],
  [/\b(madar|mather)\b/gi, 'mother'],
  [/\b(sahajjo|saahajjo|shahajjo|help\s*koro)\b/gi, 'help'],
  [/\b(koro|koroa|bolo|bolun)\b/gi, ''], // filler verbs after intent words
];

const WAKE_PREFIX =
  /^\s*((hey|hi|hello|ok|okay|yes)\s*sab[aeh]?|হে\s*সাবা|হ্যালো\s*সাবা|জি\s*সাবা|हे\s*साबा|नमस्ते\s*साबा)\s*[,:!.-]?\s*/i;

export function stripWakePhrase(text: string): string {
  return text.replace(WAKE_PREFIX, '').trim();
}

export function isWakeOnlyPhrase(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const rest = stripWakePhrase(t);
  return rest.length === 0;
}

export function parseSpokenNumber(text: string): number | undefined {
  const digit = text.match(/(\d+)/);
  if (digit) return Number(digit[1]);
  const lower = text.toLowerCase();
  for (const [word, n] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`(?:^|\\s)${word}(?:\\s|$)`, 'i').test(lower)) return n;
  }
  return undefined;
}

/** Normalize ASR / typed nursery chat before intent parse. */
export function normalizeVoiceText(input: string): string {
  let text = input.normalize('NFC').trim();
  text = text.replace(/\s+/g, ' ');
  for (const [re, rep] of ASR_FIXES) {
    text = text.replace(re, rep);
  }
  text = text.replace(
    /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|fifty|hundred|ek|dui|tin|char|panch|দশ|এক|দুই|তিন|চার|পাঁচ|दस|एक|दो|तीन)\b/gi,
    (w) => {
      const key = w.toLowerCase();
      const n = NUMBER_WORDS[key] ?? NUMBER_WORDS[w];
      return n !== undefined ? String(n) : w;
    },
  );
  return text.replace(/\s+/g, ' ').trim();
}

/** Prefer UI language when the question has no Bangla/Hindi script. */
export function resolveLang(text: string, preferred?: string): 'bn' | 'hi' | 'en' {
  if (/[\u0980-\u09FF]/.test(text)) return 'bn';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  const p = (preferred || '').toLowerCase();
  if (p.startsWith('bn')) return 'bn';
  if (p.startsWith('hi')) return 'hi';
  return 'en';
}

export type TopicScore = { topic: string; score: number };

/** Multi-signal topic scoring — highest wins; low max ⇒ clarify. */
export function scoreTopics(qRaw: string): TopicScore[] {
  const q = qRaw.toLowerCase();
  const scores: TopicScore[] = [
    { topic: 'help', score: 0 },
    { topic: 'summary', score: 0 },
    { topic: 'sales', score: 0 },
    { topic: 'stock', score: 0 },
    { topic: 'low_stock', score: 0 },
    { topic: 'mothers', score: 0 },
    { topic: 'batches', score: 0 },
    { topic: 'care', score: 0 },
    { topic: 'alerts', score: 0 },
    { topic: 'staff', score: 0 },
    { topic: 'price', score: 0 },
  ];

  const bump = (topic: string, n: number) => {
    const row = scores.find((s) => s.topic === topic);
    if (row) row.score += n;
  };

  if (/how\s*(do|to|can)|কীভাবে|কিভাবে|কি\s*ভাবে|কেমন\s*করে|कैसे|help|সাহায্য|मदद|what\s*(is|are)|কী\s*এই|menu|মডিউল|feature|guide|manual/.test(q)) {
    bump('help', 6);
  }
  if (/sell|sold|sales|বিক্রি|বিক্রয়|বিক্রয়|बिक्री|invoice|বিল|revenue|টাকা\s*এসে|pos\s*sale/.test(q)) {
    bump('sales', 6);
  }
  if (/low\s*stock|কম\s*স্টক|कम\s*स्टॉक|reorder|পুনরায়\s*অর্ডার|shortage/.test(q)) {
    bump('low_stock', 7);
  }
  if (/stock|স্টক|स्टॉक|inventory|ইনভেন্টরি|কত\s*(গুলো|টা)|how\s*many|কত\s*আছে|available/.test(q)) {
    bump('stock', 5);
  }
  if (/mother|মাদার|मादर|মাতৃ|tag\s*number|মদার|মাতৃগাছ/.test(q)) {
    bump('mothers', 6);
  }
  if (/batch|ব্যাচ|बैच|propagat|প্রোপাগ|hardening|mist|রেডি\s*ফর|ready\s*for\s*sale|চারা\s*ব্যাচ/.test(q)) {
    bump('batches', 6);
  }
  if (/care|কেয়ার|केयर|watering|জল\s*দে|पानी|spray|স্প্রে|পরিচর্যা|parichorja|task/.test(q)) {
    bump('care', 6);
  }
  if (/alert|অ্যালার্ট|अलर्ट|danger|বিপদ|intrusion|fire|আগুন|cctv|camera\s*alert/.test(q)) {
    bump('alerts', 6);
  }
  if (/staff|কর্মী|स्टाफ|people|টিম|team|user|কর্মচারী/.test(q)) {
    bump('staff', 6);
  }
  if (/price|দাম|मूल्य|rate|কত\s*টাকা|retail|wholesale/.test(q)) {
    bump('price', 5);
  }
  if (
    /today|আজ|आज|summary|সারাংশ|overview|dashboard|ড্যাশবোর্ড|কী\s*অবস্থা|status|nursery\s*info|overall|সব\s*কিছু/.test(q)
  ) {
    bump('summary', 4);
  }
  // "আজকের বিক্রি" should prefer sales over summary
  if (/today|আজ|आज/.test(q) && /sell|sales|বিক্রি|बिक्री/.test(q)) {
    bump('sales', 3);
    bump('summary', -2);
  }
  if (/today|আজ|आज/.test(q) && /stock|স্টক|स्टॉक/.test(q)) {
    bump('stock', 3);
    bump('summary', -2);
  }

  // Plant name alone (or with fillers) ⇒ prefer stock Q&A
  if (
    /adenium|mango|guava|jamun|jackfruit|mulberry|aam|peyara|এডেনি|আম|পেয়ারা|आम/.test(q) &&
    !/mother|মাদার|मादर|batch|ব্যাচ|price|দাম|मूल्य|sales|বিক্রি|बिक्री/.test(q)
  ) {
    bump('stock', 4);
  }

  return scores.sort((a, b) => b.score - a.score);
}

export function bestTopic(q: string): { topic: string; score: number; ambiguous: boolean } {
  const ranked = scoreTopics(q);
  const top = ranked[0] ?? { topic: 'help', score: 0 };
  const second = ranked[1]?.score ?? 0;
  const ambiguous = top.score < 3 || (top.score - second < 2 && top.score < 6);
  return { topic: top.topic, score: top.score, ambiguous: ambiguous && top.score < 5 };
}
