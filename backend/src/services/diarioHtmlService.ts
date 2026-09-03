import fs from 'fs';
import path from 'path';
import {
  PeriodGradeSection,
  PeriodGrade,
  Grade,
  Section,
  SchoolPeriod,
  Schedule,
  ScheduleEntry,
  Subject,
  Person,
} from '@/models';

// ── Types ──
interface PeriodInfo {
  id: string;
  start: string;
  end: string;
}

interface ScheduleSlots {
  manana: PeriodInfo[];
  tarde: PeriodInfo[];
}

interface ClassData {
  level: string;
  section: string;
  gradeOrder: number;
  // entries: key = `${day}|${periodId}` → subject name
  entries: Record<string, string>;
}

// ── Build time slots from settings (same logic as diarioService) ──
function buildSlotsFromSettings(settings: Record<string, string>): ScheduleSlots {
  const use12h = settings.time_format === '12';
  const manana: PeriodInfo[] = [];
  const tarde: PeriodInfo[] = [];

  const fmt = (h: number, m: number): string => {
    if (use12h) {
      const h12 = h % 12 || 12;
      const ampm = h < 12 ? 'AM' : 'PM';
      return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
    }
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  // Morning
  const mStart = settings.morning_start_time || '07:00';
  let [mh, mm] = mStart.split(':').map(Number);
  const mBlocksBefore = Number(settings.morning_blocks_before_recess) || 3;
  const mMinBefore = Number(settings.morning_block_minutes_before) || 45;
  const mRecess = Number(settings.morning_recess_minutes) || 0;
  const mBlocksAfter = Number(settings.morning_blocks_after_recess) || 0;
  const mMinAfter = Number(settings.morning_block_minutes_after) || 40;

  let mIdx = 1;
  for (let i = 0; i < mBlocksBefore; i++) {
    const start = fmt(mh, mm);
    mm += mMinBefore;
    while (mm >= 60) { mm -= 60; mh++; }
    manana.push({ id: `m${mIdx}`, start, end: fmt(mh, mm) });
    mIdx++;
  }
  if (mRecess > 0) {
    mm += mRecess;
    while (mm >= 60) { mm -= 60; mh++; }
  }
  for (let i = 0; i < mBlocksAfter; i++) {
    const start = fmt(mh, mm);
    mm += mMinAfter;
    while (mm >= 60) { mm -= 60; mh++; }
    manana.push({ id: `m${mIdx}`, start, end: fmt(mh, mm) });
    mIdx++;
  }

  // Afternoon
  const aStart = settings.afternoon_start_time || '13:00';
  let [ah, am] = aStart.split(':').map(Number);
  const aBlocksBefore = Number(settings.afternoon_blocks_before_recess) || 2;
  const aMinBefore = Number(settings.afternoon_block_minutes_before) || 45;
  const aRecess = Number(settings.afternoon_recess_minutes) || 0;
  const aBlocksAfter = Number(settings.afternoon_blocks_after_recess) || 0;
  const aMinAfter = Number(settings.afternoon_block_minutes_after) || 40;

  let aIdx = 1;
  for (let i = 0; i < aBlocksBefore; i++) {
    const start = fmt(ah, am);
    am += aMinBefore;
    while (am >= 60) { am -= 60; ah++; }
    tarde.push({ id: `t${aIdx}`, start, end: fmt(ah, am) });
    aIdx++;
  }
  if (aRecess > 0) {
    am += aRecess;
    while (am >= 60) { am -= 60; ah++; }
  }
  for (let i = 0; i < aBlocksAfter; i++) {
    const start = fmt(ah, am);
    am += aMinAfter;
    while (am >= 60) { am -= 60; ah++; }
    tarde.push({ id: `t${aIdx}`, start, end: fmt(ah, am) });
    aIdx++;
  }

  return { manana, tarde };
}

function formatGradeName(name: string): string {
  const match = name.match(/^(\d+)/);
  if (match) {
    return `${match[1]}° AÑO`;
  }
  return name.toUpperCase();
}

// Spanish title case: capitalize nouns/adjectives, lowercase articles/prepositions/conjunctions
const LOWER_WORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'a', 'al', 'en', 'para', 'por', 'con', 'sin',
  'sobre', 'entre', 'hasta', 'desde', 'hacia', 'según',
  'y', 'o', 'e', 'u', 'ni', 'pero', 'sino', 'que',
]);

function titleCaseSpanish(text: string): string {
  return text
    .trim()
    .split(/\s+/)
    .map((word, i) => {
      const lower = word.toLowerCase();
      // Always capitalize first word; lowercase articles/prepositions/conjunctions otherwise
      if (i > 0 && LOWER_WORDS.has(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

// ── Fetch section info + schedule entries for selected sections ──
async function fetchSectionData(
  schoolPeriodId: number,
  sectionIds: number[],
): Promise<ClassData[]> {
  const schedules = await Schedule.findAll({
    where: {
      schoolPeriodId,
      periodGradeSectionId: sectionIds,
    },
    include: [
      {
        model: PeriodGradeSection,
        as: 'section',
        include: [
          {
            model: PeriodGrade,
            as: 'periodGrade',
            include: [{ model: Grade, as: 'grade' }],
          },
          { model: Section, as: 'section' },
        ],
      },
      {
        model: ScheduleEntry,
        as: 'entries',
        include: [
          { model: Subject, as: 'subject' },
          { model: Person, as: 'teacher' },
        ],
      },
    ],
  });

  const result: ClassData[] = schedules.map((s: any) => {
    const grade = s.section?.periodGrade?.grade;
    const section = s.section?.section;
    const entries: Record<string, string> = {};
    for (const e of s.entries || []) {
      const dayUpper = (e.day || '').toUpperCase();
      const key = `${dayUpper}|${e.periodId}`;
      // If multiple entries for same slot, join with " / "
      const subjName = titleCaseSpanish(e.subject?.name ?? '');
      if (entries[key]) {
        entries[key] = entries[key] + ' / ' + subjName;
      } else {
        entries[key] = subjName;
      }
    }
    return {
      level: grade ? formatGradeName(grade.name) : '',
      section: section?.name ?? '',
      gradeOrder: grade?.order ?? 99,
      entries,
    };
  });

  result.sort((a, b) => {
    if (a.gradeOrder !== b.gradeOrder) return a.gradeOrder - b.gradeOrder;
    return (a.section || '').localeCompare(b.section || '', 'es');
  });

  return result;
}

// ── Main: generate HTML with populated data ──
export async function generateDiariosHtml(
  schoolPeriodId: number,
  sectionIds: number[],
  settings: Record<string, string>,
): Promise<string> {
  const classes = await fetchSectionData(schoolPeriodId, sectionIds);

  if (classes.length === 0) {
    throw new Error('No se encontraron secciones para los filtros seleccionados');
  }

  const slots = buildSlotsFromSettings(settings);
  // Slots with period IDs for lookups: [{ id, label }, ...]
  const morningSlots = slots.manana.map(s => ({ id: s.id, label: `${s.start} - ${s.end}` }));
  const afternoonSlots = slots.tarde.map(s => ({ id: s.id, label: `${s.start} - ${s.end}` }));

  // Read template
  const templatePath = path.join(__dirname, '..', '..', 'templates', 'diario_template.html');
  let html = fs.readFileSync(templatePath, 'utf-8');

  // Replace placeholders with real data
  const classesJson = JSON.stringify(classes);
  const morningJson = JSON.stringify(morningSlots);
  const afternoonJson = JSON.stringify(afternoonSlots);

  html = html.replace('/*__CLASSES__*/[]', classesJson);
  html = html.replace('/*__MORNING_SLOTS__*/[]', morningJson);
  html = html.replace('/*__AFTERNOON_SLOTS__*/[]', afternoonJson);

  return html;
}
