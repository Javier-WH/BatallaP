/* Generate a SQL file with all exchange rates from "Dolar History" xlsx files.
 * Uses code-based subselects so it works on any DB regardless of type IDs.
 * Output: backend/exchange_rates_import.sql
 */
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

const DIR = path.join(process.cwd(), 'Dolar History');
const OUT = path.join(process.cwd(), 'exchange_rates_import.sql');

function parseDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) {
    // Use local components, not toISOString (UTC shift risk)
    const y = raw.getFullYear(), m = String(raw.getMonth() + 1).padStart(2, '0'), d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = typeof raw === 'object' && 'text' in raw ? String(raw.text) : String(raw);
  const match = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function parseRate(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return raw;
  const n = parseFloat(String(raw).trim().replace(/,/g, '.'));
  return isNaN(n) ? null : n;
}

async function main() {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.xlsx') && !f.startsWith('~$')).sort();
  const usd = new Map(); // date -> rate (later files win)
  const eur = new Map();

  for (const file of files) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(DIR, file));
    for (const sheet of wb.worksheets) {
      const date = parseDate(sheet.getCell('G1').value);
      if (!date) continue;
      const u = parseRate(sheet.getCell('G15').value);
      const e = parseRate(sheet.getCell('G11').value);
      if (u !== null) usd.set(date, u);
      if (e !== null) eur.set(date, e);
    }
  }

  const lines = [
    '-- Exchange rates import (generated from backend/Dolar History)',
    '-- Idempotent: INSERT ... ON DUPLICATE KEY UPDATE on (exchangeRateTypeId, date)',
    '',
  ];
  const emit = (code, map) => {
    const dates = [...map.keys()].sort();
    for (let i = 0; i < dates.length; i += 300) {
      const chunk = dates.slice(i, i + 300)
        .map((d) => `((SELECT id FROM exchange_rate_types WHERE code='${code}'), ${map.get(d)}, '${d}', NOW(), NOW())`)
        .join(',\n');
      lines.push(
        `INSERT INTO exchange_rates (exchangeRateTypeId, rate, date, createdAt, updatedAt) VALUES\n${chunk}\n` +
        `ON DUPLICATE KEY UPDATE rate = VALUES(rate), updatedAt = NOW();\n`
      );
    }
  };
  emit('USD_BCV', usd);
  emit('EUR_BCV', eur);

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`Wrote ${OUT}`);
  console.log(`USD dates: ${usd.size} (${[...usd.keys()].sort()[0]} → ${[...usd.keys()].sort().slice(-1)[0]})`);
  console.log(`EUR dates: ${eur.size} (${[...eur.keys()].sort()[0]} → ${[...eur.keys()].sort().slice(-1)[0]})`);
}
main().catch((e) => { console.error(e); process.exit(1); });
