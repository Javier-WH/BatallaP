import XLSX from 'xlsx';

export interface NamedRangeRef {
  name: string;
  sheet: string;
  cell: string;
  col: number;
  row: number;
}

export interface TemplateNamedRanges {
  /** Map from named range name -> cell reference, scoped to a specific sheet */
  bySheet: Map<string, Map<string, NamedRangeRef>>;
  /** Get a named range cell reference for a specific sheet */
  getCell(sheetName: string, name: string): NamedRangeRef | null;
  /** Get all named ranges for a sheet */
  getSheetNames(sheetName: string): Map<string, NamedRangeRef>;
}

function parseRef(ref: string): { sheet: string; cell: string; col: number; row: number } | null {
  // ref format: "'Sheet Name'!$A$16" or "SheetName!$A$16"
  const match = ref.match(/^(?:'([^']+)'|([^!]+))!\$([A-Z]+)\$(\d+)$/);
  if (!match) return null;
  const sheet = match[1] || match[2];
  const colStr = match[3];
  const rowStr = match[4];
  
  // Convert column letters to number
  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64);
  }
  
  return {
    sheet,
    cell: colStr + rowStr,
    col,
    row: parseInt(rowStr, 10),
  };
}

export function readTemplateNamedRanges(filePath: string): TemplateNamedRanges {
  const wb = XLSX.readFile(filePath);
  const sheetNames = wb.SheetNames;
  const names = wb.Workbook?.Names || [];
  
  // Build map: sheetName -> (rangeName -> ref)
  const bySheet = new Map<string, Map<string, NamedRangeRef>>();
  
  for (const name of names) {
    const parsed = parseRef(name.Ref);
    if (!parsed) continue;
    
    const sheetName = parsed.sheet;
    if (!bySheet.has(sheetName)) {
      bySheet.set(sheetName, new Map());
    }
    
    bySheet.get(sheetName)!.set(name.Name, {
      name: name.Name,
      sheet: parsed.sheet,
      cell: parsed.cell,
      col: parsed.col,
      row: parsed.row,
    });
  }
  
  return {
    bySheet,
    getCell(sheetName: string, name: string): NamedRangeRef | null {
      const sheetMap = bySheet.get(sheetName);
      if (!sheetMap) return null;
      return sheetMap.get(name) || null;
    },
    getSheetNames(sheetName: string): Map<string, NamedRangeRef> {
      return bySheet.get(sheetName) || new Map();
    },
  };
}
