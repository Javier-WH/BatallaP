/* Reproduce mobile bug: 360x800, Matriculados tab, real touch swipe. */
import puppeteer from 'puppeteer';

const BASE = process.env.APP_URL || 'http://localhost:5173';
const PAGE_PATH = '/control-estudios/matricular-estudiante';

const inspect = `
(() => {
  const grid = document.querySelector('.matriculation-grid');
  if (!grid) return { error: 'no grid' };
  const info = [];
  grid.querySelectorAll('*').forEach((el) => {
    if (el.scrollHeight > el.clientHeight + 5 && el.clientHeight > 50) {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      info.push({
        cls: (el.className || '').toString().slice(0, 70),
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight,
        scrollTop: Math.round(el.scrollTop),
        overflowY: cs.overflowY,
        touchAction: cs.touchAction,
        rectTop: Math.round(r.top),
        rectBottom: Math.round(r.bottom),
      });
    }
  });
  const rows = Array.from(grid.querySelectorAll('.ag-row'));
  const last = rows[rows.length - 1];
  const lr = last && last.getBoundingClientRect();
  const wr = grid.parentElement && grid.parentElement.getBoundingClientRect();
  return {
    innerHeight: window.innerHeight,
    vvHeight: window.visualViewport && Math.round(window.visualViewport.height),
    gridRect: (() => { const r = grid.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom) }; })(),
    gridStyle: grid.style.cssText,
    wrapperRect: wr ? { top: Math.round(wr.top), bottom: Math.round(wr.bottom) } : null,
    scrollables: info,
    lastRow: lr ? { top: Math.round(lr.top), bottom: Math.round(lr.bottom), text: (last.textContent || '').slice(0, 60) } : null,
  };
})()
`;

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

  // Switch to "Matriculados" tab
  await page.evaluate(`
    (() => {
      const els = Array.from(document.querySelectorAll('.ce-page *'));
      const t = els.find((e) => e.children.length === 0 && /matriculados/i.test(e.textContent || '') && !/no\\s/i.test(e.textContent || ''));
      if (t) t.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 2500));

  console.log('BEFORE:', JSON.stringify(await page.evaluate(inspect), null, 2));

  // Real touch swipe up inside the grid
  const cx = 180;
  for (let swipe = 0; swipe < 12; swipe++) {
    await page.touchscreen.touchStart(cx, 700);
    for (let i = 1; i <= 8; i++) {
      await page.touchscreen.touchMove(cx, 700 - i * 25);
      await new Promise((r) => setTimeout(r, 20));
    }
    await page.touchscreen.touchEnd();
    await new Promise((r) => setTimeout(r, 250));
  }
  await new Promise((r) => setTimeout(r, 1500));

  console.log('AFTER SWIPES:', JSON.stringify(await page.evaluate(inspect), null, 2));

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
