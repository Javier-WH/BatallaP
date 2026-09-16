"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readTemplateNamedRanges = readTemplateNamedRanges;
const xlsx_1 = __importDefault(require("xlsx"));
function parseRef(ref) {
    // ref format: "'Sheet Name'!$A$16" or "SheetName!$A$16"
    const match = ref.match(/^(?:'([^']+)'|([^!]+))!\$([A-Z]+)\$(\d+)$/);
    if (!match)
        return null;
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
function readTemplateNamedRanges(filePath) {
    var _a;
    const wb = xlsx_1.default.readFile(filePath);
    const sheetNames = wb.SheetNames;
    const names = ((_a = wb.Workbook) === null || _a === void 0 ? void 0 : _a.Names) || [];
    // Build map: sheetName -> (rangeName -> ref)
    const bySheet = new Map();
    for (const name of names) {
        const parsed = parseRef(name.Ref);
        if (!parsed)
            continue;
        const sheetName = parsed.sheet;
        if (!bySheet.has(sheetName)) {
            bySheet.set(sheetName, new Map());
        }
        bySheet.get(sheetName).set(name.Name, {
            name: name.Name,
            sheet: parsed.sheet,
            cell: parsed.cell,
            col: parsed.col,
            row: parsed.row,
        });
    }
    return {
        bySheet,
        getCell(sheetName, name) {
            const sheetMap = bySheet.get(sheetName);
            if (!sheetMap)
                return null;
            return sheetMap.get(name) || null;
        },
        getSheetNames(sheetName) {
            return bySheet.get(sheetName) || new Map();
        },
    };
}
