/* Which element actually scrolls on touch, and what touch-action do rows/cells have? */
import puppeteer from 'puppeteer';

const BASE = process.env.APP_URL || 'http://localhost:5173';
const PAGE_PATH = '/control-estudios/matricular-estudiante';

const inspect = `
(() => {
  const grid = document.querySelector('.matriculation-grid');
  if (!grid) return { error: 'no grid' };
  const probe = (sel) => {
    const el = grid.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { overflowY: cs.overflowY, touchAction: cs.touchAction };
  };
  const scrollables = [];
  grid.querySelectorAll('*').forEach((el) => {
    if (el.scrollHeight > el.clientHeight + 5 && el.clientHeight > 50) {
      scrollables.push({ cls: (el.className || '').toString().slice(0, 60), scrollTop: Math.round(el.scrollTop) });
    }
  });
  // Page-level scroll containers too
  const pageScrollables = [];
  document.querySelectorAll('div').forEach((el) => {
    if (el.scrollHeight > el.clientHeight + 5 && el.clientHeight > 100 && !grid.contains(el)) {
      pageScrollables.push({ cls: (el.className || '').toString().slice(0, 60), scrollTop: Math.round(el.scrollTop), scrollHeight: el.scrollHeight, clientHeight: el.clientHeight });
    }
  });
  return {
    row: probe('.ag-row'),
    cell: probe('.ag-cell'),
    centerCols: probe('.ag-center-cols-viewport, .ag-center-cols-container'),
    gridScrollables: scrollables,
    pageScrollables: pageScrollables.slice(0, 6),
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
  await page.evaluate(`
    (() => {
      const els = Array.from(document.querySelectorAll('.ce-page *'));
      const t = els.find((e) => e.children.length === 0 && /matriculados/i.test(e.textContent || '') && !/no\\s/i.test(e.textContent || ''));
      if (t) t.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 2500));

  console.log('STYLES:', JSON.stringify(await page.evaluate(inspect), null, 2));

  // Real synthesized scroll gesture (CDP) on the grid
  const cdp = await page.createCDPSession();
  await cdp.send('Input.synthesizeScrollGesture', {
    x: 180, y: 700,
    xDistance: 0, yDistance: -300,
    speed: 800,
    gestureSourceType: 'touch',
  });
  await new Promise((r) => setTimeout(r, 1500));
  console.log('AFTER GESTURE:', JSON.stringify(await page.evaluate(inspect), null, 2));

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
