export interface BoletinHTMLTerm { id: number; name: string; order: number | null; }
export interface BoletinHTMLLetterGrade { letter: string; max: number; }
export interface BoletinHTMLSubject {
  id: number;
  name: string;
  teacherName?: string;
  usesLiteralGrades?: boolean;
  lapsos: { termId: number; termName: string; score: number }[];
  finalScore: number | null;
  status: string;
}
export interface BoletinHTMLStudent {
  inscriptionId: number;
  firstName: string;
  lastName: string;
  document: string;
  sectionName: string;
  sectionId?: number;
  guideTeacher?: string;
  subjects: BoletinHTMLSubject[];
}
export interface BoletinHTMLData {
  institution: {
    name: string;
    period: string;
    code: string;
    principal: string;
    address?: string;
    phone?: string;
    municipality?: string;
    state?: string;
  };
  passingGrade?: number;
  grade: { id: number; name: string };
  terms: BoletinHTMLTerm[];
  students: BoletinHTMLStudent[];
  letterGrades?: BoletinHTMLLetterGrade[];
  logoBase64?: string | null;
}

const escapeHtml = (s: string): string =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const formatScore = (score: number | null): string => {
  if (score === null || score === undefined) return '—';
  const n = Number(score);
  if (isNaN(n) || n === 0) return '—';
  return n.toFixed(1);
};

const numericToLetter = (numericGrade: number, letterGrades: BoletinHTMLLetterGrade[]): string => {
  if (!letterGrades || letterGrades.length === 0) return String(numericGrade);
  const sorted = [...letterGrades].sort((a, b) => b.max - a.max);
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (!next) return numericGrade <= current.max ? current.letter : String(numericGrade);
    if (numericGrade > next.max && numericGrade <= current.max) return current.letter;
  }
  return String(numericGrade);
};

const formatScoreForSubject = (
  score: number | null,
  usesLiteral: boolean,
  letterGrades: BoletinHTMLLetterGrade[],
): string => {
  if (score === null || score === undefined) return '—';
  if (usesLiteral) return numericToLetter(score, letterGrades);
  return formatScore(score);
};

const formatDate = (): string => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const buildStudentSheet = (
  student: BoletinHTMLStudent,
  data: BoletinHTMLData,
): string => {
  const { institution, grade, terms, letterGrades = [], passingGrade = 10 } = data;
  const fullName = escapeHtml(`${student.lastName} ${student.firstName}`.trim());
  const doc = escapeHtml(student.document || '—');
  const sectionName = escapeHtml(student.sectionName || '—');
  const guideTeacher = escapeHtml(student.guideTeacher || '—');

  // Logo HTML
  const logoHtml = data.logoBase64
    ? `<img src="${data.logoBase64}" class="logo" alt="logo" />`
    : '';

  // Build grade rows
  const rows = student.subjects.map((subj, idx) => {
    const isEven = idx % 2 === 1;
    const subjName = escapeHtml(subj.name);
    const teacher = escapeHtml(subj.teacherName || '');
    const usesLiteral = subj.usesLiteralGrades || false;

    const lapseCells = terms.map((t) => {
      const lapse = subj.lapsos.find((l) => l.termId === t.id);
      const val = formatScoreForSubject(lapse ? lapse.score : null, usesLiteral, letterGrades);
      const isDash = val === '—';
      const isLetter = usesLiteral && val !== '—';
      const cls = isDash ? 'dash' : isLetter ? 'letter' : '';
      return `<td class="${cls}">${val}</td>`;
    }).join('');

    const finalVal = formatScoreForSubject(subj.finalScore, usesLiteral, letterGrades);
    const finalIsHigh = subj.finalScore !== null && subj.finalScore >= passingGrade && !usesLiteral;
    const finalCls = finalIsHigh ? 'acum high' : finalVal === '—' ? 'dash' : 'acum';
    const finalCell = `<td class="${finalCls}">${finalVal}</td>`;

    const teacherHtml = teacher ? escapeHtml(subj.teacherName || '') : '—';

    return `<tr${isEven ? ' class="alt"' : ''}>
      <td class="subject">${subjName}</td>
      ${lapseCells}
      ${finalCell}
      <td class="teacher-cell">${teacherHtml}</td>
    </tr>`;
  }).join('');

  // Term headers
  const termShortHeaders = terms.map((t) => {
    const short = escapeHtml(t.name).replace(/\./g, '').substring(0, 10);
    return `<th>${short}</th>`;
  }).join('');

  // Summary stats: average per term
  const termAverages = terms.map((t) => {
    const scores = student.subjects
      .filter((s) => !s.usesLiteralGrades)
      .map((s) => {
        const lapse = s.lapsos.find((l) => l.termId === t.id);
        return lapse ? lapse.score : 0;
      })
      .filter((v) => v > 0);
    if (scores.length === 0) return '—';
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return avg.toFixed(2);
  });

  const finalAvgScores = student.subjects
    .filter((s) => !s.usesLiteralGrades && s.finalScore !== null)
    .map((s) => s.finalScore as number);
  const finalAvg = finalAvgScores.length > 0
    ? (finalAvgScores.reduce((a, b) => a + b, 0) / finalAvgScores.length).toFixed(2)
    : '—';

  const summaryStats = [
    ...termAverages.map((avg, i) => {
      const label = terms[i]?.name || `Lapso ${i + 1}`;
      return `<div class="stat"><div class="n">${avg}</div><div class="l">${escapeHtml(label)}</div></div>`;
    }),
    `<div class="stat"><div class="n">${finalAvg}</div><div class="l">Def.</div></div>`,
  ].join('');

  return `
  <div class="sheet">
    <div class="masthead">
      <div class="masthead-left">
        ${logoHtml}
        <div class="masthead-text">
          <p class="eyebrow">${escapeHtml(institution.name || '')}</p>
          <h1>Boletín de calificaciones</h1>
        </div>
      </div>
      <div class="period">
        Período escolar
        <strong>${escapeHtml(institution.period || '')}</strong>
        <span class="emit-date">Emitido: ${formatDate()}</span>
      </div>
    </div>

    <div class="student">
      <div class="field">
        <div class="label">Alumno</div>
        <div class="value big">${fullName}</div>
      </div>
      <div class="field">
        <div class="label">Cédula</div>
        <div class="value">${doc}</div>
      </div>
      <div class="field">
        <div class="label">Sección</div>
        <div class="value">${escapeHtml(grade.name)} ${sectionName}</div>
      </div>
      <div class="field">
        <div class="label">Docente guía</div>
        <div class="value">${guideTeacher}</div>
      </div>
    </div>

    <div class="grades">
      <table>
        <thead>
          <tr class="group">
            <th class="subject-group">Asignatura</th>
            <th colspan="${terms.length}">Calificaciones por lapso</th>
            <th>Def.</th>
            <th>Docente</th>
          </tr>
          <tr class="cols">
            <th class="subject">&nbsp;</th>
            ${termShortHeaders}
            <th>Def.</th>
            <th>Nombre</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>

    <div class="summary">
      ${summaryStats}
    </div>

    <div class="observations">
      <div class="label">Observaciones</div>
      <div>&nbsp;</div>
    </div>

    <div class="signatures">
      <div class="sig">
        <div class="line"></div>
        <div class="role">Director(a)</div>
        <div class="who">${escapeHtml(institution.principal || '')}</div>
      </div>
      <div class="sig">
        <div class="line"></div>
        <div class="role">Control de Estudios</div>
        <div class="who">&nbsp;</div>
      </div>
      <div class="sig">
        <div class="line"></div>
        <div class="role">Docente guía</div>
        <div class="who">${guideTeacher}</div>
      </div>
    </div>
  </div>`;
};

export const generateBoletinHTML = (data: BoletinHTMLData): string => {
  const sheets = data.students.map((student) => buildStudentSheet(student, data)).join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Boletín de Calificaciones</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');

  :root{
    --navy:#1B2A4A;
    --navy-deep:#101c33;
    --gold:#B08D2B;
    --gold-light:#F3E9CE;
    --paper:#FBF9F4;
    --card:#FFFFFF;
    --ink:#26241F;
    --ink-soft:#5C594F;
    --line:#E4DFD2;
    --sage:#3E6E52;
    --sage-bg:#E9F1EA;
  }

  *{ box-sizing:border-box; margin:0; padding:0; }

  html, body{
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  body{
    background:#DCD6C6;
    font-family:'Inter', sans-serif;
    color:var(--ink);
    padding:16px 0;
  }

  .sheet{
    max-width:8in;
    margin:0 auto 10px;
    background:var(--paper);
    box-shadow:0 6px 20px rgba(16,28,51,0.12);
  }

  /* Masthead */
  .masthead{
    background:var(--navy);
    background-image:linear-gradient(135deg, var(--navy) 0%, var(--navy-deep) 100%);
    color:#fff;
    padding:16px 22px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    border-bottom:3px solid var(--gold);
  }
  .masthead-left{
    display:flex;
    align-items:center;
    gap:12px;
  }
  .masthead .logo{
    width:63px;
    height:63px;
    object-fit:contain;
    flex-shrink:0;
  }
  .masthead-text{
    display:flex;
    flex-direction:column;
  }
  .masthead .eyebrow{
    font-size:11px;
    letter-spacing:.18em;
    text-transform:uppercase;
    color:var(--gold-light);
    font-weight:300;
    margin:0 0 2px;
  }
  .masthead h1{
    font-family:'Fraunces', serif;
    font-weight:600;
    font-size:19px;
    margin:0;
  }
  .masthead .period{
    text-align:right;
    font-size:10px;
    line-height:1.4;
    color:#E9E4D6;
  }
  .masthead .period strong{
    display:block;
    color:#fff;
    font-size:12px;
    font-family:'Fraunces', serif;
    font-weight:600;
  }
  .masthead .period .emit-date{
    display:block;
    font-size:9px;
    color:var(--gold-light);
    margin-top:1px;
  }

  /* Student card */
  .student{
    margin:15px 22px 7px;
    padding:15px 16px;
    background:var(--card);
    border:1px solid var(--line);
    border-left:4px solid var(--gold);
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:6px 24px;
  }
  .student .field{ font-size:11px; }
  .student .label{
    text-transform:uppercase;
    letter-spacing:.07em;
    font-size:8px;
    color:var(--ink-soft);
    font-weight:600;
    margin-bottom:1px;
  }
  .student .value{
    font-size:12px;
    font-weight:600;
    color:var(--navy);
  }
  .student .value.big{
    font-family:'Fraunces', serif;
    font-size:14px;
  }

  /* Grades table */
  .grades{
    margin:12px 22px 0;
  }
  .grades table{
    width:100%;
    border-collapse:collapse;
    background:var(--card);
    font-size:11px;
  }
  .grades thead tr.group th{
    background:var(--navy);
    color:#fff;
    font-size:8px;
    letter-spacing:.07em;
    text-transform:uppercase;
    font-weight:600;
    padding:5px 6px;
    text-align:center;
    border-right:1px solid rgba(255,255,255,0.14);
  }
  .grades thead tr.group th.subject-group{
    text-align:left;
    padding-left:10px;
  }
  .grades thead tr.cols th{
    background:#EDEAE0;
    color:var(--navy);
    font-size:9px;
    font-weight:700;
    padding:5px 6px;
    text-align:center;
    border-bottom:2px solid var(--gold);
    border-right:1px solid var(--line);
  }
  .grades thead tr.cols th.subject{ text-align:left; padding-left:10px; }
  .grades tbody td{
    padding:5px 6px;
    text-align:center;
    border-bottom:1px solid var(--line);
    border-right:1px solid var(--line);
    font-family:'IBM Plex Mono', monospace;
    font-size:11px;
    color:var(--ink);
  }
  .grades tbody td.subject{
    text-align:left;
    padding-left:10px;
    font-family:'Inter', sans-serif;
    font-weight:600;
    color:var(--ink);
    font-size:11px;
  }
  .grades tbody td.teacher-cell{
    text-align:left;
    padding-left:7px;
    font-family:'Inter', sans-serif;
    font-size:8px;
    color:var(--ink-soft);
    font-weight:400;
  }
  .grades tbody tr.alt td{ background:#F7F4EC; }
  .grades tbody td.acum{
    font-weight:700;
    color:var(--navy);
  }
  .grades tbody td.acum.high{ color:var(--sage); background:var(--sage-bg) !important; }
  .grades tbody td.dash{ color:#B7B2A2; }
  .grades tbody td.letter{
    font-weight:700;
    color:var(--gold);
  }

  /* Summary */
  .summary{
    margin:12px 22px 0;
    display:grid;
    grid-template-columns:repeat(auto-fit, minmax(80px, 1fr));
    gap:6px;
  }
  .summary .stat{
    background:var(--navy);
    color:#fff;
    padding:7px 7px;
    text-align:center;
  }
  .summary .stat .n{
    font-family:'Fraunces', serif;
    font-weight:600;
    font-size:16px;
    color:var(--gold-light);
  }
  .summary .stat .l{
    font-size:7px;
    text-transform:uppercase;
    letter-spacing:.05em;
    color:#C7CEDC;
    margin-top:1px;
  }

  /* Observations */
  .observations{
    margin:12px 22px 0;
    padding:10px 12px;
    background:var(--card);
    border:1px solid var(--line);
    min-height:30px;
  }
  .observations .label{
    text-transform:uppercase;
    letter-spacing:.07em;
    font-size:8px;
    color:var(--ink-soft);
    font-weight:600;
    margin-bottom:2px;
  }

  /* Signatures */
  .signatures{
    margin:15px 22px 17px;
    display:grid;
    grid-template-columns:repeat(3,1fr);
    gap:12px;
    text-align:center;
  }
  .signatures .sig .line{
    border-top:1px solid var(--ink);
    margin:22px 7px 3px;
  }
  .signatures .sig .role{
    font-size:8px;
    text-transform:uppercase;
    letter-spacing:.05em;
    color:var(--ink-soft);
    font-weight:600;
  }
  .signatures .sig .who{
    font-size:11px;
    font-weight:600;
    color:var(--navy);
    margin-top:1px;
  }

  @media print{
    body{ background:#fff; padding:0; }
    .sheet{
      box-shadow:none;
      max-width:none;
      width:100%;
      margin:0;
      page-break-inside:avoid;
    }
  }
</style>
</head>
<body>
${sheets}
</body>
</html>`;
};
