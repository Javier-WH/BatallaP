/* Diagnostic: reproduce the "last student unreachable" bug on a mobile viewport. */
import puppeteer from 'puppeteer';

const BASE = process.env.APP_URL || 'http://localhost:5173';
const PAGE_PATH = '/control-estudios/matricular-estudiante';

const measure = `
(() => {
  const rect = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
  };
  const grid = document.querySelector('.matriculation-grid');
  const wrapper = grid && grid.parentElement;
  const wr = wrapper && wrapper.getBoundingClientRect();
  const viewport = document.querySelector('.matriculation-grid .ag-body-viewport');
  const rows = Array.from(document.querySelectorAll('.matriculation-grid .ag-row'));
  const lastRow = rows[rows.length - 1];
  const lastRect = lastRow && lastRow.getBoundingClientRect();
  return {
    innerHeight: window.innerHeight,
    visualViewport: window.visualViewport && window.visualViewport.height,
    scrollY_state_grid_height: grid ? grid.style.height : null,
    page: rect('.ce-page'),
    contentScroller: rect('.ce-module-content > div'),
    header: rect('.ce-matriculation-toolbar'),
    wrapper: wr ? { top: Math.round(wr.top), bottom: Math.round(wr.bottom), height: Math.round(wr.height) } : null,
    grid: rect('.matriculation-grid'),
    bodyViewport: viewport ? {
      clientHeight: viewport.clientHeight,
      scrollHeight: viewport.scrollHeight,
      scrollTop: Math.round(viewport.scrollTop),
      rectBottom: Math.round(viewport.getBoundingClientRect().bottom),
    } : null,
    rowCount: rows.length,
    lastRow: lastRect ? { top: Math.round(lastRect.top), bottom: Math.round(lastRect.bottom) } : null,
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
  try {
    await page.waitForSelector('.matriculation-grid', { timeout: 20000 });
  } catch {
    console.log('GRID NOT FOUND — url:', page.url());
    console.log(await page.content().then((h) => h.slice(0, 500)));
    await browser.close();
    return;
  }
  await new Promise((r) => setTimeout(r, 2500));

  console.log('BEFORE SCROLL:', await page.evaluate(measure));

  await page.evaluate(`
    (() => {
      const vp = document.querySelector('.matriculation-grid .ag-body-viewport');
      if (vp) vp.scrollTop = vp.scrollHeight;
    })()
  `);
  await new Promise((r) => setTimeout(r, 1200));
  console.log('AFTER SCROLL:', await page.evaluate(measure));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
