/**
 * Read-only audit: compare exchange_rates (USD_BCV/EUR_BCV) against the
 * authoritative BCV xlsx files in "Dolar History/".
 *
 * Reports:
 *   - DB rows whose rate differs from the xlsx value for the same date
 *   - DB rows whose date does not exist in the xlsx set (spurious rows,
 *     e.g. saved under the scrape date instead of the Fecha Valor)
 *   - xlsx dates missing from the DB
 *
 * Usage: npx tsx _diff_exchange_rates.ts
 */
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import sequelize from './src/config/database';
import { ExchangeRate, ExchangeRateType } from './src/models/index';

const DOLAR_HISTORY_DIR = path.join(__dirname, 'Dolar History');

interface XlsxRates { usd: number | null; eur: number | null; file: string }

function parseDate(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function parseRate(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return raw;
  const str = String(raw).trim();
  if (!str) return null;
  const num = parseFloat(str.replace(/,/g, '.'));
  return isNaN(num) ? null : num;
}

async function main() {
  // 1. Build authoritative map date -> {usd, eur} from xlsx files
  const xlsx = new Map<string, XlsxRates>();
  const files = fs.readdirSync(DOLAR_HISTORY_DIR)
    .filter((f) => f.endsWith('.xlsx') && !f.startsWith('~$'))
    .sort();

  let sheetsRead = 0;
  let sheetsSkipped = 0;
  for (const file of files) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.readFile(path.join(DOLAR_HISTORY_DIR, file));
    } catch (err: any) {
      console.log(`ERROR reading ${file}: ${err.message}`);
      continue;
    }
    for (const sheet of workbook.worksheets) {
      const rawDate = sheet.getCell('G1').value;
      let dateStr: string | null = null;
      if (typeof rawDate === 'string') {
        dateStr = parseDate(rawDate);
      } else if (rawDate instanceof Date) {
        dateStr = rawDate.toISOString().slice(0, 10);
      } else if (rawDate && typeof rawDate === 'object' && 'text' in (rawDate as { text?: unknown })) {
        dateStr = parseDate(String((rawDate as { text?: unknown }).text));
      }
      if (!dateStr) { sheetsSkipped++; continue; }
      xlsx.set(dateStr, {
        usd: parseRate(sheet.getCell('G15').value),
        eur: parseRate(sheet.getCell('G11').value),
        file,
      });
      sheetsRead++;
    }
  }
  console.log(`xlsx: ${files.length} files, ${sheetsRead} sheets read, ${sheetsSkipped} skipped, ${xlsx.size} distinct dates`);

  // 2. Load DB rows
  await sequelize.authenticate();
  const usdType = await ExchangeRateType.findOne({ where: { code: 'USD_BCV' } });
  const eurType = await ExchangeRateType.findOne({ where: { code: 'EUR_BCV' } });
  if (!usdType || !eurType) {
    console.error('USD_BCV / EUR_BCV types not found');
    process.exit(1);
  }
  const dbRows = await ExchangeRate.findAll({
    where: { exchangeRateTypeId: [usdType.id, eurType.id] },
    order: [['date', 'ASC']],
  });
  console.log(`db: ${dbRows.length} rows`);

  // 3. Diff
  const xlsxDates = new Set(xlsx.keys());
  const dbByDate = new Map<string, { usd?: number; eur?: number }>();
  for (const row of dbRows) {
    const d = (row.date as unknown as string).slice(0, 10);
    const entry = dbByDate.get(d) ?? {};
    if (row.exchangeRateTypeId === usdType.id) entry.usd = Number(row.rate);
    else entry.eur = Number(row.rate);
    dbByDate.set(d, entry);
  }

  const mismatches: string[] = [];
  const spurious: string[] = [];
  for (const [date, db] of [...dbByDate.entries()].sort()) {
    const x = xlsx.get(date);
    if (!x) {
      spurious.push(`${date}  usd=${db.usd ?? '—'}  eur=${db.eur ?? '—'}  (no hay hoja BCV para esta fecha)`);
      continue;
    }
    if (db.usd != null && x.usd != null && Math.abs(db.usd - x.usd) > 0.0001) {
      mismatches.push(`${date}  USD db=${db.usd} bcv=${x.usd}`);
    }
    if (db.eur != null && x.eur != null && Math.abs(db.eur - x.eur) > 0.0001) {
      mismatches.push(`${date}  EUR db=${db.eur} bcv=${x.eur}`);
    }
  }

  const missing: string[] = [];
  for (const [date, x] of [...xlsx.entries()].sort()) {
    const db = dbByDate.get(date);
    if (!db) {
      missing.push(`${date}  usd=${x.usd ?? '—'}  eur=${x.eur ?? '—'}  (${x.file})`);
    }
  }

  console.log(`\n=== MISMATCHED RATES (${mismatches.length}) ===`);
  mismatches.forEach((m) => console.log(`  ${m}`));
  console.log(`\n=== DB DATES NOT IN BCV XLSX — spurious (${spurious.length}) ===`);
  spurious.forEach((m) => console.log(`  ${m}`));
  console.log(`\n=== BCV DATES MISSING IN DB (${missing.length}) ===`);
  missing.forEach((m) => console.log(`  ${m}`));

  await sequelize.close();
  process.exit(0);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(1); });
