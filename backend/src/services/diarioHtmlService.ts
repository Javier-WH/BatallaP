import fs from 'fs';
import path from 'path';
import {
  PeriodGradeSection,
  PeriodGrade,
  Grade,
  Section,
  SchoolPeriod,
} from '@/models';

// ── Types ──
interface PeriodInfo {
  start: string;
  end: string;
}

interface ScheduleSlots {
  manana: PeriodInfo[];
  tarde: PeriodInfo[];
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

  for (let i = 0; i < mBlocksBefore; i++) {
    const start = fmt(mh, mm);
    mm += mMinBefore;
    while (mm >= 60) { mm -= 60; mh++; }
    manana.push({ start, end: fmt(mh, mm) });
  }
  if (mRecess > 0) {
    mm += mRecess;
    while (mm >= 60) { mm -= 60; mh++; }
  }
  for (let i = 0; i < mBlocksAfter; i++) {
    const start = fmt(mh, mm);
    mm += mMinAfter;
    while (mm >= 60) { mm -= 60; mh++; }
    manana.push({ start, end: fmt(mh, mm) });
  }

  // Afternoon
  const aStart = settings.afternoon_start_time || '13:00';
  let [ah, am] = aStart.split(':').map(Number);
  const aBlocksBefore = Number(settings.afternoon_blocks_before_recess) || 2;
  const aMinBefore = Number(settings.afternoon_block_minutes_before) || 45;
  const aRecess = Number(settings.afternoon_recess_minutes) || 0;
  const aBlocksAfter = Number(settings.afternoon_blocks_after_recess) || 0;
  const aMinAfter = Number(settings.afternoon_block_minutes_after) || 40;

  for (let i = 0; i < aBlocksBefore; i++) {
    const start = fmt(ah, am);
    am += aMinBefore;
    while (am >= 60) { am -= 60; ah++; }
    tarde.push({ start, end: fmt(ah, am) });
  }
  if (aRecess > 0) {
    am += aRecess;
    while (am >= 60) { am -= 60; ah++; }
  }
  for (let i = 0; i < aBlocksAfter; i++) {
    const start = fmt(ah, am);
    am += aMinAfter;
    while (am >= 60) { am -= 60; ah++; }
    tarde.push({ start, end: fmt(ah, am) });
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

// ── Fetch section info (grade name + section name) for selected sections ──
async function fetchSectionInfo(
  schoolPeriodId: number,
  sectionIds: number[],
): Promise<{ level: string; section: string }[]> {
  // Find the SchoolPeriod to get its PeriodGrade ids
  const schoolPeriod = await SchoolPeriod.findByPk(schoolPeriodId);
  if (!schoolPeriod) {
    throw new Error('Año escolar no encontrado');
  }

  const sections = await PeriodGradeSection.findAll({
    where: {
      id: sectionIds,
    },
    include: [
      {
        model: PeriodGrade,
        as: 'periodGrade',
        where: { schoolPeriodId },
        include: [{ model: Grade, as: 'grade' }],
      },
      { model: Section, as: 'section' },
    ],
  });

  const result = sections.map((pgs: any) => {
    const grade = pgs.periodGrade?.grade;
    const section = pgs.section;
    return {
      level: grade ? formatGradeName(grade.name) : '',
      section: section?.name ?? '',
    };
  });

  // Sort by grade order then section name
  result.sort((a, b) => {
    const ga = parseInt(a.level) || 99;
    const gb = parseInt(b.level) || 99;
    if (ga !== gb) return ga - gb;
    return a.section.localeCompare(b.section, 'es');
  });

  return result;
}

// ── Main: generate HTML with populated data ──
export async function generateDiariosHtml(
  schoolPeriodId: number,
  sectionIds: number[],
  settings: Record<string, string>,
): Promise<string> {
  const classes = await fetchSectionInfo(schoolPeriodId, sectionIds);

  if (classes.length === 0) {
    throw new Error('No se encontraron secciones para los filtros seleccionados');
  }

  const slots = buildSlotsFromSettings(settings);
  const morningSlots = slots.manana.map(s => `${s.start} - ${s.end}`);
  const afternoonSlots = slots.tarde.map(s => `${s.start} - ${s.end}`);

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
