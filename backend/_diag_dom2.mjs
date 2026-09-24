/* Dump the AG Grid v36 DOM tree: classes, heights, scrollability. */
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
      const lines = [];
      const walk = (el, depth) => {
        if (depth > 5) return;
        const cls = (el.className || '').toString();
        if (!cls.includes('ag-')) return;
        const r = el.getBoundingClientRect();
        const info = cls.split(' ').filter((c) => c.startsWith('ag-')).slice(0, 4).join(' ');
        const extra = [];
        if (el.style.height) extra.push('h=' + el.style.height);
        if (el.scrollHeight > el.clientHeight + 5) extra.push('SCROLL ' + el.clientHeight + '/' + el.scrollHeight);
        lines.push('  '.repeat(depth) + info + ' [' + Math.round(r.top) + '-' + Math.round(r.bottom) + '] ' + extra.join(' '));
        Array.from(el.children).forEach((c) => walk(c, depth + 1));
      };
      walk(grid, 0);
      return lines.join('\\n');
    })()
  `));
  await browser.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
