/**
 * Import historical exchange rates from BCV Excel files.
 *
 * File structure:
 *   - Files named YYYY_Q.xlsx (e.g. 2024_1.xlsx) in backend/Dolar History/
 *   - Each file has multiple sheets, one per day
 *   - G1 = date string "DD/MM/YYYY HH:MM AM/PM"
 *   - G15 = USD rate (BCV)
 *   - G11 = EUR rate (BCV)
 *
 * Usage: npx ts-node importExchangeRates.ts
 */
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import sequelize from './src/config/database';
import { ExchangeRate, ExchangeRateType } from './src/models/index';

const DOLAR_HISTORY_DIR = path.join(__dirname, 'Dolar History');

function parseDate(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  // Format: "27/03/2024 02:55 PM"
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function parseRate(raw: any): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return raw;
  const str = String(raw).trim();
  if (!str) return null;
  // Handle both "39.25700059" and "39,25700059"
  const normalized = str.replace(/\./g, '.').replace(/,/g, '.');
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

async function main() {
  await sequelize.authenticate();

  // Get exchange rate type IDs
  const usdType = await ExchangeRateType.findOne({ where: { code: 'USD_BCV' } });
  const eurType = await ExchangeRateType.findOne({ where: { code: 'EUR_BCV' } });
  if (!usdType || !eurType) {
    console.error('Exchange rate types USD_BCV and EUR_BCV not found. Run the migration seed first.');
    process.exit(1);
  }

  console.log(`USD_BCV type ID: ${usdType.id}`);
  console.log(`EUR_BCV type ID: ${eurType.id}`);

  // List all xlsx files (excluding temp ~$ files)
  const files = fs.readdirSync(DOLAR_HISTORY_DIR)
    .filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'))
    .sort();

  console.log(`Found ${files.length} files to process`);

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  for (const file of files) {
    const filePath = path.join(DOLAR_HISTORY_DIR, file);
    console.log(`\nProcessing: ${file}`);

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.readFile(filePath);
    } catch (err: any) {
      console.error(`  ERROR reading file: ${err.message}`);
      errors.push(`${file}: ${err.message}`);
      continue;
    }

    const sheets = workbook.worksheets;
    console.log(`  ${sheets.length} sheets`);

    for (const sheet of sheets) {

      // Read G1, G11, G15 (column G = column 7)
      const g1Cell = sheet.getCell('G1');
      const g11Cell = sheet.getCell('G11');
      const g15Cell = sheet.getCell('G15');

      const rawDate = g1Cell.value;
      const rawEur = g11Cell.value;
      const rawUsd = g15Cell.value;

      // Parse date — could be a string or an Excel date object
      let dateStr: string | null = null;
      if (typeof rawDate === 'string') {
        dateStr = parseDate(rawDate);
      } else if (rawDate instanceof Date) {
        dateStr = rawDate.toISOString().slice(0, 10);
      } else if (rawDate && typeof rawDate === 'object' && 'text' in (rawDate as any)) {
        dateStr = parseDate((rawDate as any).text);
      }

      if (!dateStr) {
        totalSkipped++;
        continue;
      }

      const usdRate = parseRate(rawUsd);
      const eurRate = parseRate(rawEur);

      // Upsert USD rate
      if (usdRate !== null) {
        const [entry, created] = await ExchangeRate.findOrCreate({
          where: { exchangeRateTypeId: usdType.id, date: dateStr },
          defaults: { exchangeRateTypeId: usdType.id, rate: usdRate, date: dateStr },
        });
        if (!created) {
          await entry.update({ rate: usdRate });
          totalUpdated++;
        } else {
          totalInserted++;
        }
      } else {
        totalSkipped++;
      }

      // Upsert EUR rate
      if (eurRate !== null) {
        const [entry, created] = await ExchangeRate.findOrCreate({
          where: { exchangeRateTypeId: eurType.id, date: dateStr },
          defaults: { exchangeRateTypeId: eurType.id, rate: eurRate, date: dateStr },
        });
        if (!created) {
          await entry.update({ rate: eurRate });
          totalUpdated++;
        } else {
          totalInserted++;
        }
      } else {
        totalSkipped++;
      }
    }
  }

  console.log('\n─────────────────────────────');
  console.log(`Import complete!`);
  console.log(`  Inserted: ${totalInserted}`);
  console.log(`  Updated:  ${totalUpdated}`);
  console.log(`  Skipped:  ${totalSkipped}`);
  if (errors.length > 0) {
    console.log(`  Errors:   ${errors.length}`);
    errors.forEach(e => console.log(`    - ${e}`));
  }

  await sequelize.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
