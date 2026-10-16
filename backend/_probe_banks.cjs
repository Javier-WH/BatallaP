const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });

  // Login
  await page.waitForSelector('input');
  const inputs = await page.$$('input');
  await inputs[0].type('Javier');
  await inputs[1].type('123456');
  await page.keyboard.press('Enter');
  await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));

  await page.goto('http://localhost:5173/admin/pagos', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 2000));

  const tabs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.ant-tabs-tab')).map(t => t.textContent.trim())
  );
  console.log('TABS:', JSON.stringify(tabs));

  // Click Bancos tab
  const clicked = await page.evaluate(() => {
    const tab = Array.from(document.querySelectorAll('.ant-tabs-tab')).find(t => /banco/i.test(t.textContent));
    if (tab) { tab.click(); return true; }
    return false;
  });
  console.log('BANCOS_TAB_CLICKED:', clicked);
  await new Promise(r => setTimeout(r, 2000));

  const bankRows = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('.ant-table-row')).map(r => r.textContent.trim());
    const imgs = Array.from(document.querySelectorAll('img[src*="/uploads/banks/"]')).map(i => i.src);
    const okImgs = Array.from(document.querySelectorAll('img[src*="/uploads/banks/"]')).filter(i => i.complete && i.naturalWidth > 0).length;
    return { rowCount: rows.length, sample: rows.slice(0, 3), imgCount: imgs.length, okImgs };
  });
  console.log('BANKS:', JSON.stringify(bankRows, null, 1));

  const errors = await page.evaluate(() => window.__err || []);
  console.log('DONE');
  await browser.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
