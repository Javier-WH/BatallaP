/* ------------------------------------------------------------------ */
/* Printable HTML generator for Materia Pendiente final nómina.       */
/* Style adapted from the Resumen de Rendimiento Anual (white bg,     */
/* minimal masthead with logo only). All grades stacked vertically.   */
/* ------------------------------------------------------------------ */

export interface MpPrintEncounter {
  encounterNumber: number;
  score: number | null;
  isAbsent: boolean;
  date: string | null;
}

export interface MpPrintSubject {
  id: number;
  name: string;
  periodGradeSubjectId: number;
}

export interface MpPrintStudent {
  inscriptionId: number;
  studentName: string;
  studentDni: string;
  documentType: string;
  subjects: {
    subjectId: number;
    status: string;
    finalScore: number | null;
    encounters: MpPrintEncounter[];
  }[];
}

export interface MpNominaGradeSection {
  grade: { id: number; name: string };
  subjects: MpPrintSubject[];
  students: MpPrintStudent[];
  maxEncounters: number;
}

export interface MpNominaPrintData {
  institution: {
    name: string;
    period: string;
  };
  grades: MpNominaGradeSection[];
  logoBase64?: string | null;
}

const escapeHtml = (s: string): string =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};

const formatToday = (): string => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const docPrefix = (docType: string): string => {
  if (docType === 'Venezolano') return 'V';
  if (docType === 'Extranjero') return 'E';
  if (docType === 'Pasaporte') return 'P';
  return 'CE';
};

const buildGradeSheet = (section: MpNominaGradeSection): string => {
  const { grade, subjects, students, maxEncounters } = section;

  if (students.length === 0) return '';

  // Student rows
  const studentRows = students.map((student, idx) => {
    const isEven = idx % 2 === 1;
    const docStr = `${docPrefix(student.documentType)}-${escapeHtml(student.studentDni || '—')}`;
    const fullName = escapeHtml(student.studentName);

    const subjectCells = subjects.map(subj => {
      const studentSubj = student.subjects.find(s => s.subjectId === subj.id);
      if (!studentSubj) {
        return `<td class="subj-cell"><div class="enc-grid">${Array.from({ length: maxEncounters }, () => `<span class="enc-empty"></span>`).join('')}</div></td>`;
      }

      // Find the encounter where the student approved
      const approvedEnc = studentSubj.encounters.find(e => e.score != null && e.score >= 10 && !e.isAbsent);
      const approvedNum = approvedEnc?.encounterNumber;

      const encCells = studentSubj.encounters.map(enc => {
        const isAfterApproval = approvedNum != null && enc.encounterNumber > approvedNum;
        const hasScore = enc.score != null;

        if (isAfterApproval) {
          return `<span class="enc-closed"></span>`;
        }
        if (!hasScore) {
          return `<span class="enc-blank">—</span>`;
        }
        const isPass = (enc.score ?? 0) >= 10 && !enc.isAbsent;
        const scoreText = enc.isAbsent ? 'NP' : String(enc.score);
        const dateText = formatDate(enc.date);
        const cls = isPass ? 'enc-pass' : 'enc-fail';
        return `<span class="${cls}"><b>${escapeHtml(scoreText)}</b><i>${dateText}</i></span>`;
      }).join('');

      return `<td class="subj-cell"><div class="enc-grid">${encCells}</div></td>`;
    }).join('');

    return `<tr${isEven ? ' class="alt"' : ''}>
      <td class="col-idx">${idx + 1}</td>
      <td class="col-doc">${docStr}</td>
      <td class="col-name">${fullName}</td>
      ${subjectCells}
    </tr>`;
  }).join('');

  return `
  <div class="grade-section">
    <div class="grade-header">
      <h2>${escapeHtml(grade.name)}</h2>
      <span class="student-count">${students.length} estudiante(s)</span>
    </div>
    <table class="nomina-table">
      <thead>
        <tr>
          <th class="col-idx">#</th>
          <th class="col-doc">Cédula</th>
          <th class="col-name">Apellidos y Nombres</th>
          ${subjects.map(subj => `<th class="subj-col" title="${escapeHtml(subj.name)}">${escapeHtml(subj.name.length > 14 ? subj.name.substring(0, 12) + '…' : subj.name)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${studentRows}
      </tbody>
    </table>
  </div>`;
};

export const generateMpNominaHTML = (data: MpNominaPrintData): string => {
  const { institution, grades, logoBase64 } = data;

  const logoHtml = logoBase64
    ? `<img src="${logoBase64}" class="logo" alt="logo" />`
    : '';

  const gradeSheets = grades
    .map(g => buildGradeSheet(g))
    .filter(html => html.length > 0)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Nómina Final — Materia Pendiente</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  :root{
    --ink:#1a1a1a;
    --ink-soft:#666;
    --line:#d0d0d0;
    --line-light:#e8e8e8;
    --pass:#2e7d32;
    --pass-bg:#e8f5e9;
    --fail:#c62828;
    --fail-bg:#ffebee;
    --closed:#bdbdbd;
    --zebra:#f7f7f7;
    --header-bg:#f0f0f0;
  }

  *{ box-sizing:border-box; margin:0; padding:0; }

  html, body{
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  body{
    background:#fff;
    font-family:'Inter', sans-serif;
    color:var(--ink);
    padding:16px 0;
  }

  .sheet{
    max-width:11in;
    margin:0 auto;
    background:#fff;
  }

  /* Masthead — minimal, white bg, logo only */
  .masthead{
    padding:12px 20px 8px;
    display:flex;
    align-items:center;
    gap:14px;
    border-bottom:2px solid var(--ink);
    margin-bottom:4px;
  }
  .masthead .logo{
    width:70px;
    height:70px;
    object-fit:contain;
    flex-shrink:0;
  }
  .masthead-text{
    display:flex;
    flex-direction:column;
    gap:2px;
  }
  .masthead .inst-name{
    font-size:16px;
    font-weight:700;
    color:var(--ink);
  }
  .masthead .doc-title{
    font-size:18px;
    font-weight:700;
    color:var(--ink);
    margin-top:2px;
  }
  .masthead .period{
    margin-left:auto;
    text-align:right;
    font-size:12px;
    color:var(--ink-soft);
  }
  .masthead .period strong{
    display:block;
    font-size:13px;
    color:var(--ink);
    font-weight:600;
  }
  .masthead .emit-date{
    font-size:10px;
    color:var(--ink-soft);
    margin-top:2px;
  }

  /* Grade section */
  .grade-section{
    margin:20px 20px 28px;
    page-break-inside:avoid;
  }
  .grade-header{
    display:flex;
    align-items:baseline;
    gap:10px;
    margin-bottom:6px;
    padding-bottom:4px;
    border-bottom:1px solid var(--line);
  }
  .grade-header h2{
    font-size:14px;
    font-weight:700;
    color:var(--ink);
  }
  .grade-header .student-count{
    font-size:11px;
    color:var(--ink-soft);
  }

  /* Table */
  .nomina-table{
    width:100%;
    border-collapse:collapse;
    font-size:10px;
    font-family:'Inter', sans-serif;
  }
  .nomina-table thead th{
    background:var(--header-bg);
    color:var(--ink);
    padding:2px 4px;
    text-align:center;
    font-weight:600;
    border:1px solid var(--line);
  }
  .nomina-table tbody td{
    border:1px solid var(--line-light);
    padding:1px 4px;
    text-align:center;
    vertical-align:middle;
  }
  .nomina-table tbody tr.alt{
    background:var(--zebra);
  }
  .col-idx{
    width:26px;
    font-weight:600;
    color:var(--ink-soft);
  }
  .col-doc{
    width:75px;
    font-size:9px;
    color:var(--ink-soft);
    white-space:nowrap;
  }
  .col-name{
    text-align:left;
    min-width:150px;
    font-weight:500;
    font-size:10px;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
    max-width:200px;
  }
  .subj-col{
    min-width:48px;
    font-size:9px;
  }
  .subj-cell{
    padding:2px;
  }

  /* Encounter grid inside each cell */
  .enc-grid{
    display:grid;
    grid-template-columns:repeat(var(--enc-cols, 4), 1fr);
    gap:1px;
  }
  .enc-grid > span{
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    padding:1px 1px;
    min-height:24px;
    border-radius:2px;
    font-size:9px;
    line-height:1.1;
  }
  .enc-grid > span b{
    font-size:11px;
    font-weight:700;
  }
  .enc-grid > span i{
    font-style:normal;
    font-size:7px;
    color:var(--ink-soft);
    margin-top:1px;
  }
  .enc-pass{
    background:var(--pass-bg);
    color:var(--pass);
  }
  .enc-pass b{ color:var(--pass); }
  .enc-fail{
    background:var(--fail-bg);
    color:var(--fail);
  }
  .enc-fail b{ color:var(--fail); }
  .enc-blank{
    background:#fafafa;
    color:#ccc;
  }
  .enc-empty{
    background:#e0e0e0;
  }
  .enc-closed{
    background:var(--closed);
  }

  /* Legend */
  .legend{
    padding:8px 20px 4px;
    display:flex;
    gap:14px;
    flex-wrap:wrap;
    font-size:9px;
    color:var(--ink-soft);
  }
  .legend-item{
    display:flex;
    align-items:center;
    gap:4px;
  }
  .legend-swatch{
    width:12px;
    height:12px;
    border-radius:2px;
    display:inline-block;
  }

  /* Signatures */
  .signatures{
    padding:30px 20px 20px;
    display:flex;
    justify-content:space-around;
    gap:20px;
  }
  .sig{
    text-align:center;
    min-width:160px;
  }
  .sig .line{
    border-top:1px solid var(--ink-soft);
    margin-bottom:4px;
  }
  .sig .role{
    font-size:10px;
    font-weight:600;
    color:var(--ink);
  }
  .sig .who{
    font-size:9px;
    color:var(--ink-soft);
    margin-top:2px;
  }

  @media print{
    body{ background:#fff; padding:0; }
    .sheet{
      max-width:100%;
      margin:0;
    }
    .grade-section{
      page-break-inside:avoid;
    }
    .nomina-table{
      font-size:9px;
    }
    .nomina-table thead th{
      page-break-inside:avoid;
    }
    .nomina-table tbody tr{
      page-break-inside:avoid;
    }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="masthead">
      ${logoHtml}
      <div class="masthead-text">
        <span class="inst-name">${escapeHtml(institution.name || '')}</span>
        <span class="doc-title">Nómina Final — Materia Pendiente</span>
      </div>
      <div class="period">
        <strong>${escapeHtml(institution.period || '')}</strong>
        <span class="emit-date">Emitido: ${formatToday()}</span>
      </div>
    </div>

    ${gradeSheets}

    <div class="legend">
      <div class="legend-item"><span class="legend-swatch" style="background:var(--pass-bg)"></span> Aprobado</div>
      <div class="legend-item"><span class="legend-swatch" style="background:var(--fail-bg)"></span> Reprobado / NP</div>
      <div class="legend-item"><span class="legend-swatch" style="background:var(--closed)"></span> Cerrado (aprobó en encuentro anterior)</div>
      <div class="legend-item"><span class="legend-swatch" style="background:#fafafa;border:1px solid #ddd"></span> Sin nota</div>
    </div>

    <div class="signatures">
      <div class="sig">
        <div class="line"></div>
        <div class="role">Director(a)</div>
      </div>
      <div class="sig">
        <div class="line"></div>
        <div class="role">Control de Estudios</div>
      </div>
    </div>
  </div>
</body>
</html>`;
};
