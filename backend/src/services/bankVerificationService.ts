/**
 * Payment verification against Banco Venezolano de Crédito online banking
 * (vol.venezolano.com). There is no API, so a headless Puppeteer session logs
 * in, opens the account detail page and reads the movement tables.
 *
 * The bank keeps server-side sessions (idle timeout) and rejects a second
 * login while one is alive. We therefore keep ONE browser session warm and
 * reuse it across verifications; we only log in again when the bank shows the
 * login form again. Credentials come from env (BVC_USER / BVC_PASS) — never
 * from the repo. Queries are read-only and serialized.
 */
import puppeteer, { Browser, Page } from 'puppeteer';

const VOL_URL = 'https://vol.venezolano.com';
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Banks with a verification flow. 'natural' = web scraping; 'juridica' = bank API (future). */
export const BANK_PROVIDERS = [
  { key: 'bvc_natural', name: 'Banco Venezolano de Crédito', accountType: 'natural' as const, needsCredentials: true },
];

export interface BankMovement {
  raw: string;
  description: string;
  reference: string | null;
  cedula: string | null;
  bankCode: string | null;
  amount: number | null;
  date: string | null; // YYYY-MM-DD (null = today)
  time: string | null;
}

export interface PaymentCheckInput {
  bankCode?: string;   // 4-digit SUDEBAN code of the issuing bank (optional)
  last4: string;       // last 4 digits of the transfer reference
  cedula: string;      // payer ID number (digits only)
  date?: string;       // YYYY-MM-DD (empty = today)
}

export interface PaymentCheckResult {
  found: boolean;
  movement?: BankMovement;
  message?: string;
}

// Serialize requests: one shared session, one verification at a time.
let queue: Promise<unknown> = Promise.resolve();
const enqueue = <T>(job: () => Promise<T>): Promise<T> => {
  const p = queue.then(job, job);
  queue = p.catch(() => undefined);
  return p;
};

/* ---------------- Session handling ---------------- */

let session: { browser: Browser; page: Page } | null = null;

const isLoginPage = async (page: Page): Promise<boolean> =>
  !!(await page.$('#datoLogin').catch(() => null));

let credentials: { user: string; pass: string } | null = null;

async function login(page: Page): Promise<void> {
  if (!credentials) throw new Error('la conexión bancaria no tiene credenciales');
  const { user, pass } = credentials;
  await page.goto(VOL_URL, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#datoLogin', { timeout: 20000 });
  await page.type('#datoLogin', user);
  await page.type('#clave', pass);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {}),
    page.click('#aceptar'),
  ]);
  await wait(1500);
  const welcome = await page.evaluate(() => document.body.innerText);
  if (!/bienvenid/i.test(welcome)) {
    throw new Error('el banco no completó el inicio de sesión (¿sesión previa abierta manualmente?)');
  }
}

async function closeSession() {
  const s = session;
  session = null;
  if (s) await s.browser.close().catch(() => {});
}

/** Returns a live logged-in page, creating the browser session on first use. */
async function ensureSession(): Promise<Page> {
  if (session) {
    try {
      await session.page.evaluate(() => 1);
      return session.page;
    } catch {
      await closeSession();
    }
  }
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--window-size=1280,900'],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
  session = { browser, page };
  await login(page);
  return page;
}

/* ---------------- Movements scraping ---------------- */

function parseMovement(raw: string): BankMovement {
  const text = raw.replace(/\s+/g, ' ').trim();
  const dateMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const date = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : null;
  const timeMatch = text.match(/\b(\d{2}:\d{2})(?::\d{2})?\b/);
  const amountMatch = text.match(/(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*$/);
  const amount = amountMatch
    ? (amountMatch[1].includes(',') ? Number(amountMatch[1].replace(/\./g, '').replace(',', '.')) : Number(amountMatch[1]))
    : null;
  // The transfer reference is the LAST long digit run (the first may be the account number).
  const refs = [...text.matchAll(/\b(\d{8,})\b/g)].map(m => m[1]);
  const cedulaMatch = text.match(/\b[VEJG](\d{6,9})\b/i);
  const bankMatch = text.match(/\b(\d{4})\*\*/);
  return {
    raw: text,
    description: text.replace(/(\d{2}:\d{2}(?::\d{2})?|\d{2}\/\d{2}\/\d{4})/g, '').replace(/\b\d{8,}\b/g, '').replace(/(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*$/, '').replace(/\s+/g, ' ').trim(),
    reference: refs.length ? refs[refs.length - 1] : null,
    cedula: cedulaMatch ? cedulaMatch[1] : null,
    bankCode: bankMatch ? bankMatch[1] : null,
    amount,
    date,
    time: timeMatch ? timeMatch[1] : null,
  };
}

async function scrapeMovements(page: Page): Promise<{ today: BankMovement[]; historical: BankMovement[] }> {
  const rawTables = await page.evaluate(() => {
    const out: { title: string; rows: string[] }[] = [];
    document.querySelectorAll('table').forEach(t => {
      const rows = [...t.querySelectorAll('tr')].map(tr =>
        [...tr.querySelectorAll('td,th')].map(c => (c as HTMLElement).innerText.trim().replace(/\s+/g, ' ')).join(' ')
      ).filter(Boolean);
      if (!rows.length) return;
      const data = rows.slice(1).filter(r => !/no hay|sin movimientos/i.test(r));
      out.push({ title: rows[0], rows: data });
    });
    return out;
  });
  const today: BankMovement[] = [];
  const historical: BankMovement[] = [];
  for (const t of rawTables) {
    const isToday = /d[ií]a/i.test(t.title) && !/hist/i.test(t.title);
    const isHist = /hist/i.test(t.title);
    for (const r of t.rows) {
      const parsed = parseMovement(r);
      if (isToday) { parsed.date = null; today.push(parsed); }
      else if (isHist) historical.push(parsed);
    }
  }
  return { today, historical };
}

/** Navigate: (re-login if needed) → Cuentas Bs → account card → movements page. */
async function gotoMovements(page: Page): Promise<void> {
  if (await isLoginPage(page)) await login(page);

  let cardFound = false;
  for (let attempt = 0; attempt < 3 && !cardFound; attempt++) {
    await page.waitForFunction(() => typeof (window as any).GoIB === 'function', { timeout: 15000 })
      .catch(async () => { if (await isLoginPage(page)) await login(page); });
    const nav = page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
    await page.evaluate(() => (window as any).GoIB?.('/VOL-Web/detalleCuentaResponsivo.action', 'consultaDetalleCuenta', '021')).catch(() => {});
    await nav;
    cardFound = await page.waitForSelector('[onclick*="irDetalleCuenta"]', { timeout: 20000 })
      .then(() => true).catch(() => false);
    if (!cardFound) {
      if (await isLoginPage(page)) await login(page);
      else await wait(1500);
    }
  }
  if (!cardFound) throw new Error('la página de cuentas no cargó');

  const nav2 = page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => {});
  await page.click('[onclick*="irDetalleCuenta"]');
  await nav2;
  await page.waitForSelector('table', { timeout: 20000 }).catch(() => {});
  await wait(1500);
}

/* ---------------- Verification ---------------- */

async function runVerification(input: PaymentCheckInput, creds: { user: string; pass: string }): Promise<PaymentCheckResult> {
  try {
    // Credentials belong to one bank account; if they changed, start a fresh session.
    if (!credentials || credentials.user !== creds.user || credentials.pass !== creds.pass) {
      await closeSession();
      credentials = creds;
    }
    const page = await ensureSession();

    const digits = (s: string) => s.replace(/\D/g, '');
    const wantCedula = digits(input.cedula);
    const wantLast4 = digits(input.last4);
    const wantDate = input.date || null;
    const todayStr = new Date().toISOString().slice(0, 10);
    // The payer's bank posting date can differ ±1 business day from what the
    // receiving bank shows (cutoff/timezone), so tolerate adjacent dates.
    const dateOk = (rowDate: string) => {
      if (!wantDate || rowDate === wantDate) return true;
      const diff = Math.abs(new Date(rowDate).getTime() - new Date(wantDate).getTime());
      return diff <= 86400000;
    };
    const matches = (m: BankMovement) =>
      (m.reference?.endsWith(wantLast4) ?? false)
      && m.cedula === wantCedula
      && (!input.bankCode || m.bankCode === input.bankCode)
      // Rows in "Movimientos del día" carry no date — the bank keeps recent
      // movements there across business days, so they count for any requested
      // date. Historical rows tolerate a ±1 day posting difference.
      && (m.date == null || dateOk(m.date));

    // First pass with the current movements; if not found, reload once —
    // the bank caches the "movimientos del día" view per session visit.
    let pool: BankMovement[] = [];
    let sawHistorical = false;
    let lastError: string | null = null;
    for (let pass = 0; pass < 2; pass++) {
      try {
        await gotoMovements(page);
        const { today, historical } = await scrapeMovements(page);
        sawHistorical = sawHistorical || historical.length > 0;
        pool = [...today, ...historical];
        const hit = pool.find(matches);
        if (hit) {
          // Enrich: a "del día" hit has no date — recover it if the same
          // reference already rolled into Movimientos Históricos.
          if (!hit.date && hit.reference) {
            const dated = historical.find(h => h.reference === hit.reference);
            if (dated?.date) hit.date = dated.date;
          }
          return {
            found: true, movement: hit,
            message: hit.date ? undefined : 'Encontrado en movimientos del día (el banco no muestra la fecha de esta fila).',
          };
        }
      } catch (e: any) {
        lastError = e.message;
        if (await isLoginPage(page).catch(() => false)) await login(page).catch(() => {});
      }
      await page.reload({ waitUntil: 'networkidle2' }).catch(() => {});
    }
    if (lastError && pool.length === 0) {
      return { found: false, message: `No se pudo consultar la banca en línea: ${lastError}` };
    }

    const byRef = pool.find(m => m.reference?.endsWith(wantLast4) && m.cedula === wantCedula);
    if (byRef) {
      const why = byRef.cedula !== wantCedula ? 'la cédula no coincide' : 'el banco emisor no coincide';
      return { found: false, message: `Hay un movimiento con esa referencia, pero ${why}.` };
    }
    return {
      found: false,
      message: wantDate && wantDate !== todayStr && !sawHistorical
        ? 'No aparece en los movimientos consultados (el banco solo muestra los más recientes).'
        : 'No aparece en los movimientos del día ni en los históricos visibles.',
    };
  } catch (e: any) {
    await closeSession();
    return { found: false, message: `No se pudo consultar la banca en línea: ${e.message}` };
  }
}

export const verifyBankPayment = (input: PaymentCheckInput, creds: { user: string; pass: string }): Promise<PaymentCheckResult> =>
  enqueue(() => runVerification(input, creds));
