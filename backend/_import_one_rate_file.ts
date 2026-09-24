/**
 * One-off: import exchange rates from a single BCV xlsx file.
 * Same logic as importExchangeRates.ts but takes a file path argument.
 *
 * Usage: npx tsx _import_one_rate_file.ts "Dolar History/2026_3.xlsx"
 */
import path from 'path';
import ExcelJS from 'exceljs';
import sequelize from './src/config/database';
import { ExchangeRate, ExchangeRateType } from './src/models/index';

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
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error('Usage: npx tsx _import_one_rate_file.ts <path-to-xlsx>');
    process.exit(1);
  }
  const filePath = path.resolve(process.cwd(), fileArg);

  await sequelize.authenticate();
  const usdType = await ExchangeRateType.findOne({ where: { code: 'USD_BCV' } });
  const eurType = await ExchangeRateType.findOne({ where: { code: 'EUR_BCV' } });
  if (!usdType || !eurType) {
    console.error('Exchange rate types USD_BCV and EUR_BCV not found. Run the migration seed first.');
    process.exit(1);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  console.log(`Processing ${filePath}: ${workbook.worksheets.length} sheets`);

  let inserted = 0, updated = 0, skipped = 0;
  const missingDates: string[] = [];

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
    if (!dateStr) { skipped++; continue; }

    const pairs: Array<[number, number | null]> = [
      [usdType.id, parseRate(sheet.getCell('G15').value)],
      [eurType.id, parseRate(sheet.getCell('G11').value)],
    ];
    for (const [typeId, rate] of pairs) {
      if (rate === null) { skipped++; continue; }
      const [entry, created] = await ExchangeRate.findOrCreate({
        where: { exchangeRateTypeId: typeId, date: dateStr },
        defaults: { exchangeRateTypeId: typeId, rate, date: dateStr },
      });
      if (created) {
        inserted++;
        missingDates.push(`${dateStr} (${typeId === usdType.id ? 'USD' : 'EUR'}=${rate})`);
      } else if (Number(entry.rate) !== rate) {
        await entry.update({ rate });
        updated++;
      }
    }
  }

  console.log(`\nInserted: ${inserted}  Updated: ${updated}  Skipped: ${skipped}`);
  if (missingDates.length) {
    console.log('New rows:');
    missingDates.forEach((d) => console.log(`  ${d}`));
  }
  await sequelize.close();
  process.exit(0);
}

main().catch((err) => { console.error('Fatal error:', err); process.exit(1); });
