import {
  normalizeVoiceText,
  bestTopic,
  isWakeOnlyPhrase,
  resolveLang,
} from '../src/services/voiceNormalize';

const cases: [string, () => boolean][] = [
  ['hey saba wake', () => isWakeOnlyPhrase(normalizeVoiceText('hey saba'))],
  [
    'ajj adinium stok koro',
    () => {
      const n = normalizeVoiceText('ajj adinium stok koro');
      const t = bestTopic(n.toLowerCase());
      console.log('  norm=', n, 'topic=', t);
      return n.includes('adenium') && n.includes('stock') && t.topic === 'stock' && t.score >= 5;
    },
  ],
  ['resolveLang bn preferred', () => resolveLang('ajj adinium stok', 'bn') === 'bn'],
  [
    'bangla adenium stock',
    () => bestTopic(normalizeVoiceText('আজ এডেনিয়াম স্টক কত').toLowerCase()).topic === 'stock',
  ],
  ['help সাহায্য', () => bestTopic('সাহায্য').topic === 'help'],
  ['today sales', () => bestTopic(normalizeVoiceText('today sales').toLowerCase()).topic === 'sales'],
];

let pass = 0;
let fail = 0;
for (const [name, fn] of cases) {
  try {
    const ok = fn();
    console.log(ok ? 'PASS' : 'FAIL', name);
    if (ok) pass += 1;
    else fail += 1;
  } catch (e) {
    console.log('FAIL', name, e);
    fail += 1;
  }
}
console.log(`UNIT ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
