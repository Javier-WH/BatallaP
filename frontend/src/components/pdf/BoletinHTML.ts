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
  const termHeaders = terms.map((t) => `<th>${escapeHtml(t.name)}</th>`).join('');
  const termShortHeaders = terms.map((t) => {
    const short = escapeHtml(t.name).substring(0, 8);
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
    `<div class="stat"><div class="n">${finalAvg}</div><div class="l">Definitiva</div></div>`,
  ].join('');

  return `
  <div class="sheet">
    <div class="masthead">
      <div>
        <p class="eyebrow">${escapeHtml(institution.name || '')}</p>
        <h1>Boletín de calificaciones</h1>
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
        <div class="label">Cédula de identidad</div>
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
            <th>Definitiva</th>
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
      <div class="label">Observaciones generales</div>
      <div>&nbsp;</div>
    </div>

    <div class="signatures">
      <div class="sig">
        <div class="line"></div>
        <div class="role">Director(a) del plantel</div>
        <div class="who">${escapeHtml(institution.principal || 'Director(a)')}</div>
      </div>
      <div class="sig">
        <div class="line"></div>
        <div class="role">Coordinador(a) de control de estudios</div>
        <div class="who">&nbsp;</div>
      </div>
      <div class="sig">
        <div class="line"></div>
        <div class="role">Docente guía</div>
        <div class="who">${guideTeacher}</div>
      </div>
    </div>

    <div class="footer-strip">
      ${escapeHtml(institution.name || '')} · ${escapeHtml(institution.municipality || '')}, ${escapeHtml(institution.state || '')}
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

  *{ box-sizing:border-box; }

  body{
    margin:0;
    background:#DCD6C6;
    font-family:'Inter', sans-serif;
    color:var(--ink);
    padding:32px 0;
  }

  .sheet{
    max-width:920px;
    margin:0 auto 32px;
    background:var(--paper);
    box-shadow:0 12px 40px rgba(16,28,51,0.18);
  }

  .masthead{
    background:var(--navy);
    background-image:linear-gradient(135deg, var(--navy) 0%, var(--navy-deep) 100%);
    color:#fff;
    padding:28px 44px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    border-bottom:4px solid var(--gold);
  }
  .masthead .eyebrow{
    font-size:11px;
    letter-spacing:.16em;
    text-transform:uppercase;
    color:var(--gold-light);
    margin:0 0 6px;
    font-weight:600;
  }
  .masthead h1{
    font-family:'Fraunces', serif;
    font-weight:600;
    font-size:30px;
    margin:0;
    letter-spacing:.01em;
  }
  .masthead .period{
    text-align:right;
    font-size:13px;
    line-height:1.6;
    color:#E9E4D6;
  }
  .masthead .period strong{
    display:block;
    color:#fff;
    font-size:15px;
    font-family:'Fraunces', serif;
    font-weight:600;
  }
  .masthead .period .emit-date{
    display:block;
    font-size:11px;
    color:var(--gold-light);
    margin-top:4px;
  }

  .student{
    margin:28px 44px 8px;
    padding:22px 26px;
    background:var(--card);
    border:1px solid var(--line);
    border-left:4px solid var(--gold);
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:14px 32px;
  }
  .student .field{ font-size:13px; }
  .student .label{
    text-transform:uppercase;
    letter-spacing:.08em;
    font-size:10.5px;
    color:var(--ink-soft);
    font-weight:600;
    margin-bottom:3px;
  }
  .student .value{
    font-size:15px;
    font-weight:600;
    color:var(--navy);
  }
  .student .value.big{
    font-family:'Fraunces', serif;
    font-size:19px;
  }

  .grades{
    margin:26px 44px 0;
  }
  .grades table{
    width:100%;
    border-collapse:collapse;
    background:var(--card);
    font-size:13px;
  }
  .grades thead tr.group th{
    background:var(--navy);
    color:#fff;
    font-size:10px;
    letter-spacing:.1em;
    text-transform:uppercase;
    font-weight:600;
    padding:8px 10px;
    text-align:center;
    border-right:1px solid rgba(255,255,255,0.14);
  }
  .grades thead tr.group th.subject-group{
    text-align:left;
    padding-left:14px;
  }
  .grades thead tr.cols th{
    background:#EDEAE0;
    color:var(--navy);
    font-size:11px;
    font-weight:700;
    padding:9px 10px;
    text-align:center;
    border-bottom:2px solid var(--gold);
    border-right:1px solid var(--line);
  }
  .grades thead tr.cols th.subject{ text-align:left; padding-left:14px; }
  .grades tbody td{
    padding:9px 10px;
    text-align:center;
    border-bottom:1px solid var(--line);
    border-right:1px solid var(--line);
    font-family:'IBM Plex Mono', monospace;
    font-size:12.5px;
    color:var(--ink);
  }
  .grades tbody td.subject{
    text-align:left;
    padding-left:14px;
    font-family:'Inter', sans-serif;
    font-weight:600;
    color:var(--ink);
  }
  .grades tbody td.subject .teacher{
    display:block;
    font-weight:400;
    font-size:11px;
    color:var(--ink-soft);
    margin-top:1px;
  }
  .grades tbody td.teacher-cell{
    text-align:left;
    padding-left:10px;
    font-family:'Inter', sans-serif;
    font-size:10px;
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

  .legend{
    margin:10px 44px 0;
    font-size:10.5px;
    color:var(--ink-soft);
    display:flex;
    flex-wrap:wrap;
    gap:6px 18px;
  }

  .summary{
    margin:26px 44px 0;
    display:grid;
    grid-template-columns:repeat(auto-fit, minmax(120px, 1fr));
    gap:12px;
  }
  .summary .stat{
    background:var(--navy);
    color:#fff;
    padding:14px 16px;
    text-align:center;
  }
  .summary .stat .n{
    font-family:'Fraunces', serif;
    font-weight:600;
    font-size:24px;
    color:var(--gold-light);
  }
  .summary .stat .l{
    font-size:10px;
    text-transform:uppercase;
    letter-spacing:.08em;
    color:#C7CEDC;
    margin-top:2px;
  }

  .observations{
    margin:22px 44px 0;
    padding:16px 20px;
    background:var(--card);
    border:1px solid var(--line);
    min-height:44px;
  }
  .observations .label{
    text-transform:uppercase;
    letter-spacing:.08em;
    font-size:10.5px;
    color:var(--ink-soft);
    font-weight:600;
    margin-bottom:6px;
  }

  .signatures{
    margin:30px 44px 40px;
    display:grid;
    grid-template-columns:repeat(3,1fr);
    gap:20px;
    text-align:center;
  }
  .signatures .sig .line{
    border-top:1px solid var(--ink);
    margin:38px 10px 8px;
  }
  .signatures .sig .role{
    font-size:10.5px;
    text-transform:uppercase;
    letter-spacing:.06em;
    color:var(--ink-soft);
    font-weight:600;
  }
  .signatures .sig .who{
    font-size:13px;
    font-weight:600;
    color:var(--navy);
    margin-top:2px;
  }

  .footer-strip{
    background:var(--navy-deep);
    color:#9FA8BE;
    font-size:10.5px;
    text-align:center;
    padding:12px;
    letter-spacing:.03em;
  }

  @media print{
    body{ background:#fff; padding:0; }
    .sheet{ box-shadow:none; max-width:none; margin:0; page-break-after:always; }
    .sheet:last-child{ page-break-after:auto; }
  }
</style>
</head>
<body>
${sheets}
</body>
</html>`;
};
