/* Is the measured scrollbar inside .matriculation-grid? How many grids exist? */
import puppeteer from 'puppeteer';

const BASE = process.env.APP_URL || 'http://localhost:5173';
const PAGE_PATH = '/control-estudios/matricular-estudiante';

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 360, height: 800, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('input', { timeout: 15000 });
  const inputs = await page.$$('input');
  if (inputs.length >= 2) {
    await inputs[0].type('Javier');
    await inputs[1].type('123456');
    await page.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 3500));
  }
  await page.goto(BASE + PAGE_PATH, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('.matriculation-grid', { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 2500));
  console.log(await page.evaluate(`
    (() => {
      const all = Array.from(document.querySelectorAll('.ag-body-vertical-scroll'));
      return JSON.stringify(all.map((el) => ({
        inMatGrid: !!el.closest('.matriculation-grid'),
        insideAgGrid: (el.closest('[class*="matriculation"], [class*="ag-theme"]') || {}).className || null,
        computedWidth: getComputedStyle(el).width,
        rectW: Math.round(el.getBoundingClientRect().width),
        visible: el.getBoundingClientRect().height > 0,
        parentChain: (() => { let c = [], p = el; while (p && c.length < 4) { c.push((p.className || '').toString().slice(0, 50)); p = p.parentElement; } return c; })(),
      })), null, 2);
    })()
  `));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
