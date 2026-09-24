/* Diagnostic: reproduce the "last student unreachable" bug on a mobile viewport. */
import puppeteer from 'puppeteer';

const BASE = process.env.APP_URL || 'http://localhost:5173';
const PAGE_PATH = '/control-estudios/matricular-estudiante';

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  // ~20:9 phone
  await page.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[console.error]', msg.text());
  });

  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });

  // Login
  await page.waitForSelector('input', { timeout: 15000 });
  const inputs = await page.$$('input');
  if (inputs.length >= 2) {
    await inputs[0].type('Javier');
    await inputs[1].type('123456');
    await page.keyboard.press('Enter');
    await new Promise((r) => setTimeout(r, 3000));
  }

  await page.goto(BASE + PAGE_PATH, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('.matriculation-grid', { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 2500));

  const report = await page.evaluate(() => {
    const rect = (sel: string) => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
    };
    const viewport = document.querySelector('.matriculation-grid .ag-body-viewport') as HTMLElement | null;
    const rows = Array.from(document.querySelectorAll('.matriculation-grid .ag-row'));
    const lastRow = rows[rows.length - 1] as HTMLElement | undefined;
    const lastRect = lastRow?.getBoundingClientRect();
    return {
      innerHeight: window.innerHeight,
      visualViewport: window.visualViewport?.height,
      page: rect('.ce-page'),
      scroller: rect('.control-estudios-responsive .ce-module-content > div') ?? rect('.ce-module-content'),
      header: rect('.ce-matriculation-toolbar'),
      wrapper: null as any,
      grid: rect('.matriculation-grid'),
      bodyViewport: viewport
        ? {
            clientHeight: viewport.clientHeight,
            scrollHeight: viewport.scrollHeight,
            scrollTop: viewport.scrollTop,
            rect: { top: Math.round(viewport.getBoundingClientRect().top), bottom: Math.round(viewport.getBoundingClientRect().bottom) },
          }
        : null,
      rowCount: rows.length,
      lastRow: lastRect ? { top: Math.round(lastRect.top), bottom: Math.round(lastRect.bottom) } : null,
    };
  });

  // Measure the grid wrapper (ref div is the direct parent of .matriculation-grid)
  report.wrapper = await page.evaluate(() => {
    const grid = document.querySelector('.matriculation-grid');
    const wrapper = grid?.parentElement;
    if (!wrapper) return null;
    const r = wrapper.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height), class: wrapper.className };
  });

  console.log(JSON.stringify(report, null, 2));

  // Try scrolling the grid body to the bottom and re-measure the last row
  await page.evaluate(() => {
    const vp = document.querySelector('.matriculation-grid .ag-body-viewport') as HTMLElement | null;
    if (vp) vp.scrollTop = vp.scrollHeight;
  });
  await new Promise((r) => setTimeout(r, 1200));
  const after = await page.evaluate(() => {
    const vp = document.querySelector('.matriculation-grid .ag-body-viewport') as HTMLElement | null;
    const rows = Array.from(document.querySelectorAll('.matriculation-grid .ag-row'));
    const lastRow = rows[rows.length - 1] as HTMLElement | undefined;
    const r = lastRow?.getBoundingClientRect();
    return {
      scrollTop: vp?.scrollTop,
      scrollHeight: vp?.scrollHeight,
      lastRow: r ? { top: Math.round(r.top), bottom: Math.round(r.bottom) } : null,
      rowCount: rows.length,
    };
  });
  console.log('AFTER SCROLL:', JSON.stringify(after, null, 2));

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
