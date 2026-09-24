/* Check min/max-width and flex-basis that could clamp the 9px width. */
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
      const dump = (el) => {
        if (!el) return null;
        const cs = getComputedStyle(el);
        return {
          w: cs.width, minW: cs.minWidth, maxW: cs.maxWidth,
          flexBasis: cs.flexBasis, flexShrink: cs.flexShrink, flexGrow: cs.flexGrow,
          inline: { w: el.style.width, minW: el.style.minWidth, flexB: el.style.flexBasis, cssText: (el.getAttribute('style') || '').slice(0, 150) },
        };
      };
      return JSON.stringify({
        vscroll: dump(document.querySelector('.matriculation-grid .ag-body-vertical-scroll')),
        vviewport: dump(document.querySelector('.matriculation-grid .ag-body-vertical-scroll-viewport')),
        hscroll: dump(document.querySelector('.matriculation-grid .ag-body-horizontal-scroll')),
      }, null, 2);
    })()
  `));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
