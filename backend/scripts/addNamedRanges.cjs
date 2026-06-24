const JSZip = require('jszip');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

function colToLetter(col) {
  let result = '';
  while (col > 0) {
    const rem = (col - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    col = Math.floor((col - 1) / 26);
  }
  return result;
}

async function addNamedRanges() {
  const templatePath = path.resolve(process.cwd(), 'templates/ResumenFinal_Template.xlsx');
  const buf = fs.readFileSync(templatePath);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);

  const definedNames = [];

  const instRanges = [
    { name: 'inst_period', cell: 'M3' },
    { name: 'inst_eval_type', cell: 'N4' },
    { name: 'inst_code', cell: 'E7' },
    { name: 'inst_name', cell: 'J7' },
    { name: 'inst_address', cell: 'C8' },
    { name: 'inst_phone', cell: 'U8' },
    { name: 'inst_municipality', cell: 'C9' },
    { name: 'inst_state', cell: 'G9' },
    { name: 'inst_cdcee', cell: 'N9' },
    { name: 'inst_director', cell: 'C10' },
    { name: 'inst_director_doc', cell: 'N10' },
  ];

  const studentFields = [
    { prefix: 'std_num', col: 1 },
    { prefix: 'std_doc', col: 2 },
    { prefix: 'std_ln', col: 4 },
    { prefix: 'std_fn', col: 6 },
    { prefix: 'std_bp', col: 8 },
    { prefix: 'std_ef', col: 9 },
    { prefix: 'std_sx', col: 10 },
    { prefix: 'std_bd', col: 11 },
    { prefix: 'std_bm', col: 12 },
    { prefix: 'std_by', col: 13 },
  ];

  const MAX_STUDENTS = 35;
  const DATA_START_ROW = 16;

  wb.worksheets.forEach(function(ws, sheetIdx) {
    const sheetName = ws.name;
    const sheetRef = "'" + sheetName + "'";

    // Add institution ranges (sheet-scoped)
    instRanges.forEach(function(r) {
      const colLetter = r.cell.charAt(0);
      const rowNum = r.cell.substring(1);
      definedNames.push({
        name: r.name,
        ref: sheetRef + '!$' + colLetter + '$' + rowNum,
        localSheetId: sheetIdx
      });
    });

    // Discover subject columns from row 15
    const r15 = ws.getRow(15);
    const subjCols = [];
    for (let c = 14; c <= ws.columnCount; c++) {
      const v = r15.getCell(c).value;
      if (v && typeof v === 'string' && v.trim().length > 0 && !v.includes('PARTICIPACION') && !v.includes('PARTICIPACIÓN')) {
        subjCols.push({ col: c, abbr: v.trim() });
      }
    }

    const partCol = subjCols.length > 0 ? Math.max.apply(null, subjCols.map(function(s) { return s.col; })) + 1 : 14;

    // Subject header named ranges
    subjCols.forEach(function(s, i) {
      var colLetter = colToLetter(s.col);
      definedNames.push({
        name: 'subj_' + (i + 1),
        ref: sheetRef + '!$' + colLetter + '$15',
        localSheetId: sheetIdx
      });
    });

    // Student data named ranges
    for (var n = 1; n <= MAX_STUDENTS; n++) {
      var row = DATA_START_ROW + (n - 1);

      studentFields.forEach(function(f) {
        var colLetter = colToLetter(f.col);
        definedNames.push({
          name: f.prefix + '_' + n,
          ref: sheetRef + '!$' + colLetter + '$' + row,
          localSheetId: sheetIdx
        });
      });

      subjCols.forEach(function(s, i) {
        var colLetter = colToLetter(s.col);
        definedNames.push({
          name: 'grade_' + (i + 1) + '_' + n,
          ref: sheetRef + '!$' + colLetter + '$' + row,
          localSheetId: sheetIdx
        });
      });

      var partColLetter = colToLetter(partCol);
      definedNames.push({
        name: 'std_part_' + n,
        ref: sheetRef + '!$' + partColLetter + '$' + row,
        localSheetId: sheetIdx
      });
    }
  });

  console.log('Total defined names: ' + definedNames.length);

  // Inject into workbook.xml
  const zip = await JSZip.loadAsync(buf);
  const workbookXml = await zip.file('xl/workbook.xml').async('string');

  var dnXml = definedNames.map(function(d) {
    return '<definedName name="' + d.name + '" localSheetId="' + d.localSheetId + '">' + d.ref + '</definedName>';
  }).join('');

  var newXml = workbookXml.replace(
    /<\/sheets>/,
    '</sheets><definedNames>' + dnXml + '</definedNames>'
  );

  zip.file('xl/workbook.xml', newXml);

  var newBuf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(templatePath, newBuf);

  console.log('Named ranges added to template successfully!');

  var bySheet = {};
  definedNames.forEach(function(d) {
    var sheet = d.ref.split('!')[0].replace(/'/g, '');
    if (!bySheet[sheet]) bySheet[sheet] = 0;
    bySheet[sheet]++;
  });
  Object.keys(bySheet).forEach(function(k) {
    console.log('  ' + k + ': ' + bySheet[k] + ' names');
  });
}

addNamedRanges().catch(console.error);
