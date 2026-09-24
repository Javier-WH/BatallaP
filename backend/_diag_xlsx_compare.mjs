/* Compare two BCV xlsx files: sheets, dates (G1), USD (G15), EUR (G11). */
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

const NEW_FILE = 'C:\\Users\\Axioma\\Downloads\\Dolar History\\2026_3.xlsx';
const OLD_FILE = path.join(process.cwd(), 'Dolar History', '2026_3.xlsx');

function parseDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  const str = typeof raw === 'object' && 'text' in raw ? raw.text : String(raw);
  const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

async function loadDates(file) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const out = new Map();
  for (const sheet of wb.worksheets) {
    const d = parseDate(sheet.getCell('G1').value);
    const usd = sheet.getCell('G15').value;
    const eur = sheet.getCell('G11').value;
    out.set(d || `?(${sheet.name})`, { sheet: sheet.name, usd: String(usd), eur: String(eur) });
  }
  return out;
}

async function main() {
  console.log('NEW exists:', fs.existsSync(NEW_FILE));
  console.log('OLD exists:', fs.existsSync(OLD_FILE));
  const [newMap, oldMap] = await Promise.all([loadDates(NEW_FILE), loadDates(OLD_FILE)]);
  console.log(`NEW sheets/dates: ${newMap.size}  |  OLD: ${oldMap.size}`);

  const onlyNew = [...newMap.keys()].filter((d) => !oldMap.has(d)).sort();
  const onlyOld = [...oldMap.keys()].filter((d) => !newMap.has(d)).sort();
  const common = [...newMap.keys()].filter((d) => oldMap.has(d));

  console.log(`\nDates only in NEW (${onlyNew.length}):`);
  onlyNew.forEach((d) => console.log(`  ${d}  USD=${newMap.get(d).usd}  EUR=${newMap.get(d).eur}`));
  console.log(`\nDates only in OLD (${onlyOld.length}):`, onlyOld.join(', ') || 'none');
  console.log(`\nCommon: ${common.length}, range ${common.sort()[0]} → ${common.sort().slice(-1)[0]}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
