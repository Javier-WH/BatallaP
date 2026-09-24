/* Flat list of ag-* classes + which elements hold rows / scroll. */
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
  console.log(await page.evaluate(`
    (() => {
      const grid = document.querySelector('.matriculation-grid');
      const out = { childCount: grid.children.length, rowCount: grid.querySelectorAll('.ag-row').length };
      // The element that directly contains the rows:
      const row = grid.querySelector('.ag-row');
      out.rowParentChain = [];
      let p = row;
      while (p && p !== grid) {
        const cs = getComputedStyle(p);
        out.rowParentChain.push({
          cls: (p.className || '').toString().slice(0, 70),
          inlineH: p.style.height || null,
          computedH: cs.height,
          overflowY: cs.overflowY,
        });
        p = p.parentElement;
      }
      // All scrollable descendants
      out.scrollables = [];
      grid.querySelectorAll('*').forEach((el) => {
        if (el.scrollHeight > el.clientHeight + 5 && el.clientHeight > 50) {
          out.scrollables.push({ cls: (el.className || '').toString().slice(0, 70), c: el.clientHeight, s: el.scrollHeight });
        }
      });
      return JSON.stringify(out, null, 2);
    })()
  `));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
