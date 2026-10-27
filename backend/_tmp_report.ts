/**
 * One-off report: group-subject definitives that changed after the
 * pickGroupSubjectForTerm fallback fix (periods with sparse per-term choices).
 * Generates an XLSX to review printed Notas Certificadas.
 */
import ExcelJS from 'exceljs';
import sequelize from '@/config/database';
import { Setting } from '@/models';
import { roundFinalGrade, isPassingGrade } from '@/services/gradeEvaluationService';
import { GradeCalculationService } from '@/services/gradeCalculationService';
import { pickGroupSubjectForTerm } from '@/services/subjectGroupService';

const PASSING = 10;

function numericToLetter(numericGrade: number, letterGrades: { letter: string; max: number }[]): string {
  if (!letterGrades || letterGrades.length === 0) return String(numericGrade);
  const sorted = [...letterGrades].sort((a, b) => b.max - a.max);
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (!next) return numericGrade <= current.max ? current.letter : String(numericGrade);
    if (numericGrade > next.max && numericGrade <= current.max) return current.letter;
  }
  return String(numericGrade);
}

(async () => {
  const q = async (sql: string): Promise<any[]> => { const [r]: any = await sequelize.query(sql); return r; };

  const settingsRows = await Setting.findAll();
  const settings: Record<string, string> = {};
  for (const s of settingsRows as any[]) settings[s.key] = s.value;
  const letterGrades: { letter: string; max: number }[] = (() => {
    try { const parsed = JSON.parse(settings.letter_grades || ''); return parsed.scale || parsed || []; }
    catch { return []; }
  })();

  const rows = await q(`SELECT s.id isId, s.inscriptionId, s.subjectId, sub.name subjectName, sub.subjectGroupId grp,
      i.schoolPeriodId, i.gradeId, i.sectionId, i.rosterNumber, p.lastName, p.firstName, p.document,
      g.name gradeName, sec.name sectionName, per.period
    FROM inscription_subjects s
    JOIN subjects sub ON sub.id=s.subjectId AND sub.subjectGroupId IS NOT NULL
    JOIN inscriptions i ON i.id=s.inscriptionId
    JOIN people p ON p.id=i.personId
    JOIN school_periods per ON per.id=i.schoolPeriodId
    LEFT JOIN grades g ON g.id=i.gradeId
    LEFT JOIN sections sec ON sec.id=i.sectionId`);
  const termGrades = await q(`SELECT inscriptionSubjectId isId, termId, score FROM subject_term_grades`);
  const choices = await q(`SELECT inscriptionId, subjectGroupId grp, termId, subjectId FROM inscription_group_term_choices`);
  const terms = await q(`SELECT id, schoolPeriodId, \`order\` ord, name FROM terms`);

  const tgByIs = new Map<number, Map<number, number>>();
  for (const t of termGrades) {
    const m = tgByIs.get(t.isId) ?? new Map<number, number>();
    m.set(t.termId, Number(t.score));
    tgByIs.set(t.isId, m);
  }
  const termsByPeriod = new Map<number, any[]>();
  for (const t of terms) termsByPeriod.set(t.schoolPeriodId, [...(termsByPeriod.get(t.schoolPeriodId) ?? []), t]);

  const byKey = new Map<string, any[]>();
  for (const r of rows) byKey.set(`${r.inscriptionId}:${r.grp}`, [...(byKey.get(`${r.inscriptionId}:${r.grp}`) ?? []), r]);

  const affected: any[] = [];
  for (const [key, subjects] of byKey) {
    const [insId, grp] = key.split(':').map(Number);
    const ch = choices.filter(c => c.inscriptionId === insId && c.grp === grp);
    if (ch.length === 0) continue;
    const periodTerms = (termsByPeriod.get(subjects[0].schoolPeriodId) ?? []).sort((a, b) => a.ord - b.ord);
    const periodTermIds = new Set(periodTerms.map((t: any) => t.id));
    const latest = [...ch].filter(c => periodTermIds.has(c.termId))
      .sort((a, b) => (periodTerms.find(t => t.id === b.termId)?.ord ?? 0) - (periodTerms.find(t => t.id === a.termId)?.ord ?? 0))[0];

    const rowsWithGrades = subjects.map(s => ({
      subjectId: s.subjectId,
      termGrades: [...(tgByIs.get(s.isId)?.keys() ?? [])].map(termId => ({ termId })),
    }));
    const gradeFor = (subjectId: number | undefined, termId: number): number | null => {
      const row = subjects.find(s => s.subjectId === subjectId);
      return row ? (tgByIs.get(row.isId)?.get(termId) ?? null) : null;
    };

    const oldLapsos = periodTerms.map(t => {
      const choice = ch.find(c => c.termId === t.id);
      return { termId: t.id, finalScore: gradeFor(choice?.subjectId, t.id) };
    });
    const newLapsos = periodTerms.map(t => {
      const choice = ch.find(c => c.termId === t.id);
      const sel = pickGroupSubjectForTerm(rowsWithGrades, t.id, choice?.subjectId, latest?.subjectId);
      return { termId: t.id, finalScore: gradeFor(sel?.subjectId, t.id) };
    });

    const oldVal = GradeCalculationService.calculateFinalScore(oldLapsos, null);
    const newVal = GradeCalculationService.calculateFinalScore(newLapsos, null);
    if (oldVal !== newVal) {
      const sel = subjects.find(s => s.subjectId === latest?.subjectId) ?? subjects[0];
      affected.push({
        period: sel.period,
        gradeName: sel.gradeName, sectionName: sel.sectionName, roster: sel.rosterNumber,
        student: `${sel.lastName}, ${sel.firstName}`, document: sel.document,
        subject: sel.subjectName,
        lapsos: newLapsos.map(l => l.finalScore == null ? '—' : roundFinalGrade(l.finalScore)),
        oldVal, newVal,
        flips: oldVal != null && newVal != null && isPassingGrade(oldVal, PASSING) !== isPassingGrade(newVal, PASSING),
      });
    }
  }

  affected.sort((a, b) =>
    Number(b.flips) - Number(a.flips)
    || String(a.period).localeCompare(String(b.period))
    || String(a.gradeName).localeCompare(String(b.gradeName))
    || String(a.sectionName).localeCompare(String(b.sectionName))
    || String(a.student).localeCompare(String(b.student)));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Casos a revisar');
  ws.columns = [
    { header: '#', key: 'n', width: 5 },
    { header: 'Período', key: 'period', width: 11 },
    { header: 'Año', key: 'grade', width: 14 },
    { header: 'Sección', key: 'section', width: 8 },
    { header: 'N° lista', key: 'roster', width: 8 },
    { header: 'Estudiante', key: 'student', width: 38 },
    { header: 'Cédula', key: 'doc', width: 12 },
    { header: 'Materia de grupo', key: 'subject', width: 26 },
    { header: 'Lapso 1', key: 'l1', width: 7 },
    { header: 'Lapso 2', key: 'l2', width: 7 },
    { header: 'Lapso 3', key: 'l3', width: 7 },
    { header: 'Nota impresa (errada)', key: 'old', width: 13 },
    { header: 'Nota correcta', key: 'now', width: 11 },
    { header: 'Literal errado', key: 'oldL', width: 8 },
    { header: 'Literal correcto', key: 'nowL', width: 8 },
    { header: 'Cambia aprob./reprob.', key: 'flip', width: 12 },
    { header: 'Revisado', key: 'done', width: 9 },
  ];
  affected.forEach((a, i) => {
    const r = ws.addRow({
      n: i + 1, period: a.period, grade: a.gradeName, section: a.sectionName, roster: a.roster ?? '',
      student: a.student, doc: a.document ?? '', subject: a.subject,
      l1: a.lapsos[0], l2: a.lapsos[1], l3: a.lapsos[2],
      old: a.oldVal == null ? '' : String(a.oldVal).padStart(2, '0'),
      now: a.newVal == null ? '' : String(a.newVal).padStart(2, '0'),
      oldL: a.oldVal == null ? '' : numericToLetter(a.oldVal, letterGrades).toUpperCase(),
      nowL: a.newVal == null ? '' : numericToLetter(a.newVal, letterGrades).toUpperCase(),
      flip: a.flips ? 'SÍ' : '', done: '',
    });
    if (a.flips) { r.font = { bold: true, color: { argb: 'FF9C0006' } }; r.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } }; }
  });
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
  ws.pageSetup.orientation = 'landscape';
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 0;
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const out = 'D:/JavierWorkSpace/BatallaProject/casos-materias-de-grupo-a-revisar.xlsx';
  await wb.xlsx.writeFile(out);
  console.log('total', affected.length, '| flips', affected.filter(a => a.flips).length, '| file', out);
  console.log(JSON.stringify(affected.filter(a => a.flips).map(a => `${a.student} | ${a.subject} | ${a.lapsos.join(',')} | ${a.oldVal}->${a.newVal}`), null, 0));
  await sequelize.close();
})();
