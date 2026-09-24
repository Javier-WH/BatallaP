/* Measure the fake scrollbar column: widths, backgrounds, computed styles. */
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
      const grid = document.querySelector('.matriculation-grid');
      const info = (el) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          w: Math.round(r.width), h: Math.round(r.height),
          bg: cs.backgroundColor, position: cs.position,
          inlineW: el.style.width || null, inlineH: el.style.height || null,
          scrollbarWidth: cs.scrollbarWidth,
          // offsetWidth - clientWidth = native scrollbar thickness
          barThickness: el.offsetWidth - el.clientWidth,
        };
      };
      return JSON.stringify({
        vscroll: info(grid.querySelector('.ag-body-vertical-scroll')),
        vviewport: info(grid.querySelector('.ag-body-vertical-scroll-viewport')),
        vcontainer: info(grid.querySelector('.ag-body-vertical-scroll-container')),
        hscroll: info(grid.querySelector('.ag-body-horizontal-scroll')),
        hviewport: info(grid.querySelector('.ag-body-horizontal-scroll-viewport')),
        hcontainer: info(grid.querySelector('.ag-body-horizontal-scroll-container')),
      }, null, 2);
    })()
  `));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
