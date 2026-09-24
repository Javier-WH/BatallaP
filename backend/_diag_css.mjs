/* Why doesn't width:9px !important apply? Inspect inline priority + matching rules. */
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
      const el = document.querySelector('.ag-body-vertical-scroll');
      const out = {
        exists: !!el,
        computedWidth: el ? getComputedStyle(el).width : null,
        inlinePriority: el ? el.style.getPropertyPriority('width') : null,
        inlineWidth: el ? el.style.width : null,
      };
      // Is our rule present in any loaded stylesheet?
      out.rulesFound = [];
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            if (rule.cssText && rule.cssText.includes('ag-body-vertical-scroll')) {
              out.rulesFound.push(rule.cssText.slice(0, 200));
            }
          }
        } catch (e) {}
      }
      return JSON.stringify(out, null, 2);
    })()
  `));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
