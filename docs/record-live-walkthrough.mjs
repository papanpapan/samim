/**
 * Live Playwright screen recording with visible mouse cursor.
 * One silent MP4 reused for EN / BN / HI voiceovers.
 *
 * Requires: API :4000 + client HTTPS :5173 running.
 * Run: node docs/record-live-walkthrough.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'nacecary_photos_and_flowers_for_testing', 'demo_videos');
const workDir = path.join(outDir, '_live_record');
const BASE = process.env.SN_ERMS_URL || 'https://127.0.0.1:5173';

fs.mkdirSync(workDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function smoothMove(page, x, y, steps = 18) {
  await page.mouse.move(x, y, { steps });
}

async function clickAt(page, locator, holdMs = 400) {
  const box = await locator.boundingBox();
  if (!box) {
    await locator.click({ timeout: 8000 });
    return;
  }
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await smoothMove(page, x, y);
  await sleep(holdMs);
  await page.mouse.click(x, y);
}

async function scrollSlow(page, amount, steps = 8) {
  const each = amount / steps;
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, each);
    await sleep(120);
  }
}

async function visitNav(page, href, dwellMs) {
  const link = page.locator(`nav a[href="${href}"]`).first();
  await link.waitFor({ state: 'visible', timeout: 15000 });
  await clickAt(page, link, 500);
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await sleep(Math.round(dwellMs * 0.35));
  await scrollSlow(page, 520);
  await sleep(Math.round(dwellMs * 0.25));
  await scrollSlow(page, 380);
  await sleep(Math.round(dwellMs * 0.2));
  await scrollSlow(page, -450);
  await sleep(Math.round(dwellMs * 0.2));
}

async function main() {
  console.log('Recording live walkthrough from', BASE);
  for (const f of fs.readdirSync(workDir)) {
    fs.rmSync(path.join(workDir, f), { force: true, recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    slowMo: 45,
    args: ['--ignore-certificate-errors'],
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: workDir, size: { width: 1280, height: 720 } },
    locale: 'en-IN',
  });

  const page = await context.newPage();

  // Visible demo cursor (Playwright video does not draw OS cursor).
  await page.addInitScript(() => {
    const ensure = () => {
      if (document.getElementById('__sn_demo_cursor')) return;
      const c = document.createElement('div');
      c.id = '__sn_demo_cursor';
      c.style.cssText = [
        'position:fixed',
        'left:0',
        'top:0',
        'width:22px',
        'height:22px',
        'margin-left:-4px',
        'margin-top:-4px',
        'border-radius:50% 50% 50% 0',
        'transform:rotate(-28deg)',
        'background:linear-gradient(135deg,#16a34a,#166534)',
        'border:2px solid #fff',
        'box-shadow:0 2px 10px rgba(0,0,0,.4)',
        'pointer-events:none',
        'z-index:2147483647',
        'transition:left 40ms linear,top 40ms linear',
      ].join(';');
      document.documentElement.appendChild(c);
      window.addEventListener(
        'mousemove',
        (e) => {
          c.style.left = `${e.clientX}px`;
          c.style.top = `${e.clientY}px`;
        },
        { passive: true },
      );
    };
    ensure();
    document.addEventListener('DOMContentLoaded', ensure);
  });

  // 1) Login (~45s)
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);
  await smoothMove(page, 640, 200, 24);
  await sleep(2000);

  const adminDemo = page.getByRole('button', { name: /admin/i }).first();
  if (await adminDemo.count()) {
    await clickAt(page, adminDemo, 700);
    await sleep(2500);
  }
  const managerDemo = page.getByRole('button', { name: /manager/i }).first();
  if (await managerDemo.count()) {
    await clickAt(page, managerDemo, 600);
    await sleep(2000);
  }
  const staffDemo = page.getByRole('button', { name: /staff/i }).first();
  if (await staffDemo.count()) {
    await clickAt(page, staffDemo, 500);
    await sleep(1800);
  }
  if (await adminDemo.count()) {
    await clickAt(page, adminDemo, 600);
    await sleep(2000);
  }

  await page.fill('#email', 'admin@sabanursery.com');
  await sleep(800);
  await page.fill('#password', 'Admin@12345');
  await sleep(1500);
  const signIn = page.locator('form button.btn-primary').first();
  await clickAt(page, signIn, 800);
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30000 });
  await sleep(4500);

  // 2) Platform (owner) (~55s)
  const platformLink = page.locator('nav a[href="/platform"]').first();
  if (await platformLink.count()) {
    await clickAt(page, platformLink, 600);
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await sleep(6000);
    await scrollSlow(page, 560);
    await sleep(3500);
    await scrollSlow(page, 480);
    await sleep(3000);
    await scrollSlow(page, -400);
    await sleep(2500);

    const openBtn = page.getByRole('button', { name: /^open$/i }).first();
    if (await openBtn.count()) {
      await clickAt(page, openBtn, 700);
      await page.waitForURL((url) => url.pathname === '/' || url.pathname === '', { timeout: 20000 }).catch(() => {});
      await sleep(5000);
    }
  }

  // 3) Today / Dashboard (~50s)
  await visitNav(page, '/', 18000);
  const cards = page.locator('a, button').filter({ hasText: /alert|care|stock|batch|mother|ready/i });
  const cardCount = Math.min(5, await cards.count());
  for (let i = 0; i < cardCount; i++) {
    const box = await cards.nth(i).boundingBox();
    if (box) {
      await smoothMove(page, box.x + box.width / 2, box.y + box.height / 2, 18);
      await sleep(1600);
    }
  }
  await sleep(3000);

  // 4–11) Core modules — long dwell so total ~6.5–7.5 min
  await visitNav(page, '/nursery', 28000);
  await visitNav(page, '/mother-plants', 30000);
  await visitNav(page, '/propagation', 28000);
  await visitNav(page, '/inventory', 28000);
  await visitNav(page, '/pos', 32000);

  const search = page.locator('input[type="search"], input[placeholder*="earch" i], input[placeholder*="SKU" i]').first();
  if (await search.count()) {
    await clickAt(page, search, 500);
    await search.fill('mango');
    await sleep(3500);
    await search.fill('');
    await sleep(2000);
  }

  await visitNav(page, '/alerts', 28000);
  await visitNav(page, '/care', 26000);

  const reports = page.locator('nav a[href="/reports"]').first();
  if (await reports.count()) {
    await visitNav(page, '/reports', 22000);
  }
  const admin = page.locator('nav a[href="/admin"]').first();
  if (await admin.count()) {
    await visitNav(page, '/admin', 20000);
  }
  const vermi = page.locator('nav a[href="/vermicompost"]').first();
  if (await vermi.count()) {
    await visitNav(page, '/vermicompost', 18000);
  }
  const dist = page.locator('nav a[href="/distribution"]').first();
  if (await dist.count()) {
    await visitNav(page, '/distribution', 18000);
  }

  // Back to Today — closing beat
  await visitNav(page, '/', 22000);
  await smoothMove(page, 640, 360, 28);
  await sleep(6000);

  const videoPath = await page.video().path();
  await context.close();
  await browser.close();

  const dest = path.join(outDir, 'SN-ERMS_Live_Walkthrough_Silent.webm');
  // Playwright writes .webm; copy after context close flushes file
  await sleep(800);
  const src = videoPath && fs.existsSync(videoPath)
    ? videoPath
    : fs.readdirSync(workDir).map((n) => path.join(workDir, n)).find((p) => p.endsWith('.webm'));
  if (!src || !fs.existsSync(src)) {
    throw new Error('No Playwright video file produced');
  }
  fs.copyFileSync(src, dest);
  const mb = (fs.statSync(dest).size / (1024 * 1024)).toFixed(1);
  console.log(`OK silent live record → ${dest} (${mb} MB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
