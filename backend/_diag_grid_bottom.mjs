/* Definitive test: at max scroll, is the last data row fully visible? 360x800, Matriculados. */
import puppeteer from 'puppeteer';

const BASE = process.env.APP_URL || 'http://localhost:5173';
const PAGE_PATH = '/control-estudios/matricular-estudiante';

const inspect = `
(() => {
  const grid = document.querySelector('.matriculation-grid');
  if (!grid) return { error: 'no grid' };
  const vps = [];
  grid.querySelectorAll('*').forEach((el) => {
    if (el.scrollHeight > el.clientHeight + 5 && el.clientHeight > 50) {
      vps.push({ cls: (el.className || '').toString().slice(0, 60), clientHeight: el.clientHeight, scrollHeight: el.scrollHeight, scrollTop: Math.round(el.scrollTop) });
    }
  });
  const rows = Array.from(grid.querySelectorAll('.ag-row'));
  const info = rows.map((r) => {
    const b = r.getBoundingClientRect();
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), text: (r.textContent || '').slice(0, 45) };
  });
  const gr = grid.getBoundingClientRect();
  return {
    innerHeight: window.innerHeight,
    gridBottom: Math.round(gr.bottom),
    scrollables: vps,
    rendered: info.length,
    firstRows: info.slice(0, 2),
    lastRows: info.slice(-3),
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

  // Scroll both scroll containers to the very bottom
  await page.evaluate(`
    (() => {
      const grid = document.querySelector('.matriculation-grid');
      grid.querySelectorAll('*').forEach((el) => {
        if (el.scrollHeight > el.clientHeight + 5) el.scrollTop = el.scrollHeight;
      });
    })()
  `);
  await new Promise((r) => setTimeout(r, 2000));

  console.log('AT MAX SCROLL:', JSON.stringify(await page.evaluate(inspect), null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
