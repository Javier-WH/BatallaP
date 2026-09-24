/* Find the real scroll container inside the AG Grid and check last-row reachability. */
import puppeteer from 'puppeteer';

const BASE = process.env.APP_URL || 'http://localhost:5173';
const PAGE_PATH = '/control-estudios/matricular-estudiante';

const measure = `
(() => {
  const grid = document.querySelector('.matriculation-grid');
  if (!grid) return { error: 'no grid' };
  // Elements inside the grid that can scroll vertically
  const scrollables = [];
  grid.querySelectorAll('*').forEach((el) => {
    if (el.scrollHeight > el.clientHeight + 5 && el.clientHeight > 50) {
      const r = el.getBoundingClientRect();
      scrollables.push({
        cls: (el.className || '').toString().slice(0, 80),
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        scrollTop: Math.round(el.scrollTop),
        rectTop: Math.round(r.top),
        rectBottom: Math.round(r.bottom),
      });
    }
  });
  const rows = Array.from(grid.querySelectorAll('.ag-row'));
  const last = rows[rows.length - 1];
  const lr = last && last.getBoundingClientRect();
  const first = rows[0];
  const fr = first && first.getBoundingClientRect();
  return {
    innerHeight: window.innerHeight,
    gridStyle: grid.style.cssText,
    scrollables,
    rowCount: rows.length,
    firstRow: fr ? { top: Math.round(fr.top), bottom: Math.round(fr.bottom), text: (first.textContent || '').slice(0, 40) } : null,
    lastRenderedRow: lr ? { top: Math.round(lr.top), bottom: Math.round(lr.bottom), text: (last.textContent || '').slice(0, 40) } : null,
  };
})()
`;

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
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

  console.log('BEFORE:', JSON.stringify(await page.evaluate(measure), null, 2));

  // Scroll every scrollable element inside the grid to its bottom
  await page.evaluate(`
    (() => {
      const grid = document.querySelector('.matriculation-grid');
      grid.querySelectorAll('*').forEach((el) => {
        if (el.scrollHeight > el.clientHeight + 5) el.scrollTop = el.scrollHeight;
      });
    })()
  `);
  await new Promise((r) => setTimeout(r, 1500));
  console.log('AFTER:', JSON.stringify(await page.evaluate(measure), null, 2));

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
