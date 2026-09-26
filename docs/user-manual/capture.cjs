const fs = require('fs');
const path = require('path');
const puppeteer = require(path.join(process.env.TEMP, 'manual-shot', 'node_modules', 'puppeteer-core'));

const out = path.join(__dirname, 'screenshots');
fs.mkdirSync(out, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clickText(page, text) {
  const ok = await page.evaluate((label) => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.replace(/\s+/g, ' ').trim().includes(label));
    if (!btn) return false;
    btn.click();
    return true;
  }, text);
  if (!ok) throw new Error(`Button not found: ${text}`);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(out, name), type: 'png' });
  console.log(name);
}

async function go(page, route) {
  await page.goto('http://localhost:5173' + route, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('h1', { timeout: 15000 });
  await sleep(900);
}

async function signIn(page, role) {
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForSelector('h1', { timeout: 15000 });
  await sleep(400);
  await clickText(page, role);
  await sleep(200);
  await clickText(page, 'Sign in');
  await page.waitForFunction(() => location.pathname === '/', { timeout: 20000 });
  await page.waitForSelector('h1', { timeout: 15000 });
  await sleep(900);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--window-size=1440,900', '--hide-scrollbars'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.evaluate(() => localStorage.setItem('sn-lang', 'en'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('h1', { timeout: 15000 });
  await sleep(600);
  await shot(page, '01-login.png');

  await signIn(page, 'Admin');
  await shot(page, '02-dashboard.png');

  await clickText(page, 'English');
  await sleep(400);
  await shot(page, '03-language.png');
  await page.keyboard.press('Escape');
  await page.mouse.click(400, 500);
  await sleep(200);

  await go(page, '/');
  await clickText(page, 'Reading and display');
  await sleep(400);
  await shot(page, '04-display.png');
  await page.mouse.click(400, 500);
  await sleep(200);

  await go(page, '/mother-plants');
  await shot(page, '05-mother-plants.png');
  await go(page, '/propagation');
  await shot(page, '06-propagation.png');
  await go(page, '/inventory');
  await shot(page, '07-inventory.png');

  await go(page, '/pos');
  const scan = await page.$('input[placeholder*="SKU"]');
  if (!scan) throw new Error('Scan box missing');
  await scan.click({ clickCount: 3 });
  await scan.type('PLT-BDG-5X7-01');
  await clickText(page, 'Add');
  await page.waitForFunction(() => document.body.innerText.includes('Net Total'), { timeout: 10000 });
  await page.evaluate(() => {
    const pay = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'UPI_PHONEPE_GPAY'));
    if (!pay) return;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(pay, 'UPI_PHONEPE_GPAY');
    pay.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(1200);
  await shot(page, '08-pos.png');

  await go(page, '/vermicompost');
  await shot(page, '09-vermicompost.png');
  await go(page, '/care');
  await shot(page, '10-care.png');
  await go(page, '/distribution');
  await shot(page, '11-distribution.png');
  await go(page, '/reports');
  await shot(page, '12-accounts.png');
  await go(page, '/admin');
  await shot(page, '13-admin.png');

  await clickText(page, 'Logout');
  await page.waitForFunction(() => location.pathname === '/login', { timeout: 15000 });

  await signIn(page, 'Staff');
  await shot(page, '14-staff-dashboard.png');
  await go(page, '/mother-plants');
  await shot(page, '15-staff-mothers.png');

  await clickText(page, 'Logout');
  await page.waitForFunction(() => location.pathname === '/login', { timeout: 15000 });

  await signIn(page, 'Cashier');
  await go(page, '/pos');
  await shot(page, '16-cashier-pos.png');

  await browser.close();
  console.log('done');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
