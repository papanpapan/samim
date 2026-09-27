/**
 * Voice chatbot API test report (UTF-8).
 * Usage: node scripts/voice-api-test.mjs
 */
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const API = process.env.API_URL || 'http://localhost:4000/api/v1';
const EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@sabanursery.com';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';
const __dirname = dirname(fileURLToPath(import.meta.url));

const cases = [
  { q: 'hey saba', lang: 'bn', expectIntent: 'greet', expectIncludes: ['জি', 'সাহায্য'] },
  { q: 'ajj adinium stok koro', lang: 'bn', expectIntent: 'query_ask', expectIncludes: ['Adenium', 'স্টক'] },
  { q: 'আজ এডেনিয়াম স্টক কত', lang: 'bn', expectIntent: 'query_ask', expectIncludes: ['Adenium', 'স্টক'] },
  { q: 'adenium stock today', lang: 'en', expectIntent: 'query_ask', expectIncludes: ['Adenium', 'stock'] },
  { q: 'today sales', lang: 'en', expectIntent: 'query_ask', expectIncludes: ['today'] },
  { q: 'low stock', lang: 'en', expectIntent: 'query_ask', expectIncludes: ['Low-stock', 'low'] },
  { q: 'how many mothers', lang: 'en', expectIntent: 'query_ask', expectIncludes: ['Mother'] },
  { q: 'সাহায্য', lang: 'bn', expectIntent: 'query_ask', expectIncludes: ['Field Hub', 'স্টক'] },
  { q: 'xyz abc nonsense', lang: 'en', expectIntent: 'query_ask', expectIncludes: ['not sure', 'Try'] },
];

function okIncludes(summary, needles) {
  const s = summary.toLowerCase();
  return needles.some((n) => s.includes(String(n).toLowerCase()));
}

async function main() {
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const login = await loginRes.json();
  if (!loginRes.ok) {
    console.error('LOGIN_FAIL', login);
    process.exit(1);
  }
  const token = login.data.token;
  const nurseryId = login.data.user?.nurseryId || login.data.user?.nursery?.id || '';
  console.log(`LOGIN_OK nursery=${nurseryId || '(from jwt/tenant)'}`);

  const rows = [];
  let pass = 0;
  let fail = 0;

  for (const c of cases) {
    const res = await fetch(`${API}/voice-agent/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${token}`,
        ...(nurseryId ? { 'X-Nursery-Id': nurseryId } : {}),
      },
      body: JSON.stringify({ text: c.q, lang: c.lang }),
    });
    const body = await res.json();
    if (!res.ok) {
      fail += 1;
      rows.push({ status: 'FAIL', q: c.q, reason: JSON.stringify(body).slice(0, 200) });
      continue;
    }
    const data = body.data;
    const intentOk = data.intent?.name === c.expectIntent;
    const textOk = okIncludes(data.summary || '', c.expectIncludes);
    const conf = data.confidence ?? 0;
    const confOk = c.q.includes('nonsense') || c.q === 'hey saba' || conf >= 0.7;
    const good = intentOk && textOk && confOk;
    if (good) pass += 1;
    else fail += 1;
    rows.push({
      status: good ? 'PASS' : 'FAIL',
      q: c.q,
      intent: data.intent?.name,
      conf,
      intentOk,
      textOk,
      confOk,
      summary: (data.summary || '').replace(/\s+/g, ' ').slice(0, 160),
      suggestions: (data.suggestions || []).slice(0, 3),
    });
  }

  const report = [
    '# Saba Voice Chatbot — Test Report',
    '',
    `Date: ${new Date().toISOString()}`,
    `API: ${API}`,
    `Result: ${pass}/${pass + fail} passed, ${fail} failed`,
    '',
    '| Status | Query | Intent | Conf | Summary (trim) |',
    '|--------|-------|--------|------|----------------|',
    ...rows.map(
      (r) =>
        `| ${r.status} | ${String(r.q).replace(/\|/g, '/')} | ${r.intent || r.reason || ''} | ${r.conf ?? ''} | ${String(r.summary || r.reason || '').replace(/\|/g, '/')} |`,
    ),
    '',
  ].join('\n');

  const out = join(__dirname, 'voice-test-report.md');
  writeFileSync(out, report, 'utf8');
  console.log(report);
  console.log(`\nWrote ${out}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
