/* Verify: at max scroll, does the last row clear the horizontal scrollbar zone? */
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
  await new Promise((r) => setTimeout(r, 2000));
  await page.evaluate(`
    (() => {
      const els = Array.from(document.querySelectorAll('.ce-page *'));
      const t = els.find((e) => e.children.length === 0 && /matriculados/i.test(e.textContent || '') && !/no\\s/i.test(e.textContent || ''));
      if (t) t.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 2500));
  await page.evaluate(`
    (() => {
      const grid = document.querySelector('.matriculation-grid');
      grid.querySelectorAll('*').forEach((el) => {
        if (el.scrollHeight > el.clientHeight + 5) el.scrollTop = el.scrollHeight;
      });
    })()
  `);
  await new Promise((r) => setTimeout(r, 2000));
  console.log(JSON.stringify(await page.evaluate(`
    (() => {
      const grid = document.querySelector('.matriculation-grid');
      const container = grid.querySelector('.ag-center-cols-container');
      const rows = Array.from(grid.querySelectorAll('.ag-row'));
      const last = rows[rows.length - 1];
      const lr = last && last.getBoundingClientRect();
      const hscroll = grid.querySelector('.ag-body-horizontal-scroll, .ag-body-horizontal-scroll-viewport');
      const hr = hscroll && hscroll.getBoundingClientRect();
      return {
        containerHeight: container ? getComputedStyle(container).height : 'NOT FOUND',
        containerPad: container ? getComputedStyle(container).paddingBottom : null,
        hscrollZone: hr ? { top: Math.round(hr.top), bottom: Math.round(hr.bottom) } : 'none',
        lastRow: lr ? { top: Math.round(lr.top), bottom: Math.round(lr.bottom), text: (last.textContent || '').slice(0, 45) } : null,
      };
    })()
  `), null, 2));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
