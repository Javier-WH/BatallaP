import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import {
  Inscription,
  Person,
  PersonResidence,
  InscriptionSubject,
  Subject,
  SubjectFinalGrade,
  SubjectGroup,
  PeriodGrade,
  PeriodGradeSubject,
  Term,
  Qualification,
  EvaluationPlan,
  CouncilPoint,
  SchoolPeriod,
  Grade,
  Section,
  Setting,
  Plantel,
} from '@/models/index';
import {
  getSubjectOrderMap,
  sortSubjectsByOrder,
} from '@/services/subjectOrderService';
import { readTemplateNamedRanges } from '@/services/templateNamedRanges';

function getStateAbbrev(stateName: string): string {
  if (!stateName) return '';
  const abbrev: Record<string, string> = {
    'GUARICO': 'GU', 'MIRANDA': 'MI', 'CARABOBO': 'CA', 'ZULIA': 'ZU',
    'ARAGUA': 'AR', 'BARINAS': 'BA', 'BOLIVAR': 'BO', 'COJEDES': 'CO',
    'PORTUGUESA': 'PO', 'LARA': 'LA', 'YARACUY': 'YA', 'FALCON': 'FA',
    'VARGAS': 'VA', 'MERIDA': 'ME', 'TRUJILLO': 'TR', 'TACHIRA': 'TA',
    'APURE': 'AP', 'GUAIRA': 'GU', 'NUEVA ESPARTA': 'NE', 'SUCRE': 'SU',
    'ANZOATEGUI': 'AN', 'MONAGAS': 'MO', 'DELTA AMACURO': 'DA',
    'AMAZONAS': 'AM', 'DISTRITO CAPITAL': 'DC', 'DEPENDENCIAS FEDERALES': 'DF',
  };
  return abbrev[stateName.toUpperCase()] || stateName.substring(0, 2).toUpperCase();
}

function formatDateES(date: Date | string | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatScore(score: number | null): string {
  if (score === null || score === undefined) return '';
  const n = Number(score);
  if (isNaN(n) || n === 0) return '';
  return n.toFixed(1);
}

export const exportCertifiedGrades = async (req: Request, res: Response) => {
  try {
    const personId = parseInt(req.query.personId as string, 10);
    const templateName = req.query.template as string;

    if (!personId) {
      return res.status(400).json({ message: 'personId es obligatorio' });
    }
    if (!templateName) {
      return res.status(400).json({ message: 'template es obligatorio' });
    }

    const templatePath = path.join(__dirname, '../../templates', templateName);
    if (!fs.existsSync(templatePath)) {
      return res.status(400).json({ message: `Plantilla no encontrada: ${templateName}` });
    }

    const person = await Person.findByPk(personId, {
      include: [{ model: PersonResidence, as: 'residence' }],
    });

    if (!person) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }

    const settingsRows = await Setting.findAll();
    const settings: Record<string, string> = {};
    settingsRows.forEach((s: any) => { settings[s.key] = s.value; });

    let plantel: any = null;
    if (settings.institution_dea_code) {
      plantel = await Plantel.findOne({ where: { code: settings.institution_dea_code } });
    }

    const inscriptions = await Inscription.findAll({
      where: { personId },
      include: [
        { model: SchoolPeriod, as: 'period' },
        { model: Grade, as: 'grade' },
        { model: Section, as: 'section' },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          include: [
            { model: Subject, as: 'subject', include: [{ model: SubjectGroup, as: 'subjectGroup' }] },
            { model: SubjectFinalGrade, as: 'finalGrade' },
            {
              model: Qualification,
              as: 'qualifications',
              include: [{ model: EvaluationPlan, as: 'evaluationPlan' }],
            },
            { model: CouncilPoint, as: 'councilPoints' },
          ],
        },
      ],
      order: [
        [{ model: SchoolPeriod, as: 'period' }, 'period', 'ASC'],
        [{ model: Grade, as: 'grade' }, 'order', 'ASC'],
      ],
    });

    const allPeriodIds = [...new Set(inscriptions.map((ins: any) => ins.schoolPeriodId))];
    const termsByPeriod: Record<number, any[]> = {};
    const subjectOrderByPeriod: Record<number, Map<number, number>> = {};

    for (const periodId of allPeriodIds) {
      const terms = await Term.findAll({
        where: { schoolPeriodId: periodId },
        order: [['order', 'ASC']],
      });
      termsByPeriod[periodId] = terms;

      const firstIns = inscriptions.find((ins: any) => ins.schoolPeriodId === periodId);
      if (firstIns) {
        const pg = await PeriodGrade.findOne({
          where: { schoolPeriodId: periodId, gradeId: firstIns.gradeId },
        });
        subjectOrderByPeriod[periodId] = pg ? await getSubjectOrderMap(pg.id) : new Map();
      }
    }

    const years = inscriptions.map((ins: any) => {
      const terms = termsByPeriod[ins.schoolPeriodId] || [];
      const termCount = terms.length || 1;
      const orderMap = subjectOrderByPeriod[ins.schoolPeriodId] || new Map();

      const insSubs = sortSubjectsByOrder(
        (ins.inscriptionSubjects || []).filter((is: any) => !is.subject?.subjectGroupId),
        (is: any) => is.subjectId,
        (is: any) => is.subject?.name || '',
        orderMap,
      );

      const subjects = insSubs.map((is: any) => {
        const termScores: Record<number, number> = {};
        terms.forEach((t: any) => { termScores[t.id] = 0; });

        (is.qualifications || []).forEach((q: any) => {
          if (q.isAbsent) return;
          const score = q.remedialScore != null && Number(q.remedialScore) > 0
            ? Number(q.remedialScore) : Number(q.score) || 0;
          const percentage = Number(q.evaluationPlan?.percentage) || 0;
          const termId = q.evaluationPlan?.termId;
          if (termId && termScores[termId] !== undefined) {
            termScores[termId] += score * (percentage / 100);
          }
        });

        (is.councilPoints || []).forEach((cp: any) => {
          const pVal = Number(cp.points) || 0;
          if (cp.termId && termScores[cp.termId] !== undefined) {
            termScores[cp.termId] += pVal;
          }
        });

        let finalScore: number | null = null;
        if (is.finalGrade && is.finalGrade.finalScore != null) {
          finalScore = Number(is.finalGrade.finalScore);
        } else {
          let total = 0;
          Object.values(termScores).forEach((v) => { total += v; });
          finalScore = Math.round((total / termCount) * 100) / 100;
        }

        return {
          id: is.subjectId,
          name: is.subject?.name || '',
          lapsos: terms.map((t: any) => ({
            termId: t.id,
            termName: t.name,
            score: Math.round((termScores[t.id] || 0) * 100) / 100,
          })),
          finalScore,
        };
      });

      return {
        periodName: ins.period?.name || ins.period?.period || '',
        gradeName: ins.grade?.name || '',
        sectionName: ins.section?.name || '',
        terms: terms.map((t: any) => ({ id: t.id, name: t.name, order: t.order })),
        subjects,
      };
    });

    const templatesDir = path.join(__dirname, '../../templates');
    const namedRanges = await readTemplateNamedRanges(templatePath);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      return res.status(400).json({ message: 'La plantilla no tiene hojas' });
    }

    const sheetName = sheet.name;

    const setter = (name: string, value: string | number) => {
      if (!value || value === '' || value === 0) return;
      const ref = namedRanges.getCell(sheetName, name);
      if (ref) {
        sheet.getCell(ref.cell).value = value;
        return;
      }
      try {
        const definedName = (workbook.definedNames as any).get(name);
        if (definedName) {
          sheet.getCell(definedName).value = value;
        }
      } catch { /* ignore if named range not found */ }
    };

    const residence = (person as any).residence;

    setter('plantel_code', settings.institution_dea_code || plantel?.code || '');
    setter('plantel_name', settings.institution_name || plantel?.name || '');
    setter('education_code', settings.institution_code || '');
    setter('education_type', settings.institution_level || '');
    setter('plantel_address', settings.institution_address || '');
    setter('plantel_municipality', settings.institution_municipality || plantel?.municipality || '');
    setter('plantel_phone', settings.institution_phone || '');
    setter('plantel_state', plantel?.state || '');
    setter('cdcee', settings.institution_cdcee || '');
    setter('expedition_place_date', formatDateES(new Date()));

    setter('student_doc', person.document || '');
    setter('student_birthdate', person.birthdate ? formatDateES(person.birthdate) : '');
    setter('student_lastname', person.lastName || '');
    setter('student_firstname', person.firstName || '');
    setter('student_birth_country', 'Venezuela');
    setter('student_birth_state', residence?.birthState || '');
    setter('student_birth_municipality', residence?.birthMunicipality || '');

    let yearIdx = 1;
    for (const year of years) {
      setter(`year_${yearIdx}`, year.periodName);
      let subjIdx = 1;
      for (const subj of year.subjects) {
        setter(`y${yearIdx}_s${subjIdx}_name`, subj.name);
        let lapsoIdx = 1;
        for (const lapse of subj.lapsos) {
          setter(`y${yearIdx}_s${subjIdx}_l${lapsoIdx}`, formatScore(lapse.score));
          lapsoIdx++;
        }
        setter(`y${yearIdx}_s${subjIdx}_def`, formatScore(subj.finalScore));
        subjIdx++;
      }
      let termIdx = 1;
      for (const term of year.terms) {
        setter(`y${yearIdx}_lapso_${termIdx}`, term.name);
        termIdx++;
      }
      yearIdx++;
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `notas-certificadas-${person.lastName}-${person.firstName}.xlsx`.replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('[exportCertifiedGrades] Error:', error);
    res.status(500).json({ message: error.message || 'Error al exportar notas certificadas' });
  }
};

export const getCertifiedGradesData = async (req: Request, res: Response) => {
  try {
    const personId = parseInt(req.query.personId as string, 10);
    if (!personId) {
      return res.status(400).json({ message: 'personId es obligatorio' });
    }

    const person = await Person.findByPk(personId, {
      include: [{ model: PersonResidence, as: 'residence' }],
    });
    if (!person) {
      return res.status(404).json({ message: 'Estudiante no encontrado' });
    }

    const settingsRows = await Setting.findAll();
    const settings: Record<string, string> = {};
    settingsRows.forEach((s: any) => { settings[s.key] = s.value; });

    let plantel: any = null;
    if (settings.institution_dea_code) {
      plantel = await Plantel.findOne({ where: { code: settings.institution_dea_code } });
    }

    const inscriptions = await Inscription.findAll({
      where: { personId },
      include: [
        { model: SchoolPeriod, as: 'period' },
        { model: Grade, as: 'grade' },
        { model: Section, as: 'section' },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          include: [
            { model: Subject, as: 'subject', include: [{ model: SubjectGroup, as: 'subjectGroup' }] },
            { model: SubjectFinalGrade, as: 'finalGrade' },
            {
              model: Qualification,
              as: 'qualifications',
              include: [{ model: EvaluationPlan, as: 'evaluationPlan' }],
            },
            { model: CouncilPoint, as: 'councilPoints' },
          ],
        },
      ],
      order: [
        [{ model: SchoolPeriod, as: 'period' }, 'period', 'ASC'],
        [{ model: Grade, as: 'grade' }, 'order', 'ASC'],
      ],
    });

    const allPeriodIds = [...new Set(inscriptions.map((ins: any) => ins.schoolPeriodId))];
    const termsByPeriod: Record<number, any[]> = {};
    const subjectOrderByPeriod: Record<number, Map<number, number>> = {};

    for (const periodId of allPeriodIds) {
      const terms = await Term.findAll({
        where: { schoolPeriodId: periodId },
        order: [['order', 'ASC']],
      });
      termsByPeriod[periodId] = terms;

      const firstIns = inscriptions.find((ins: any) => ins.schoolPeriodId === periodId);
      if (firstIns) {
        const pg = await PeriodGrade.findOne({
          where: { schoolPeriodId: periodId, gradeId: firstIns.gradeId },
        });
        subjectOrderByPeriod[periodId] = pg ? await getSubjectOrderMap(pg.id) : new Map();
      }
    }

    const years = inscriptions.map((ins: any) => {
      const terms = termsByPeriod[ins.schoolPeriodId] || [];
      const termCount = terms.length || 1;
      const orderMap = subjectOrderByPeriod[ins.schoolPeriodId] || new Map();

      const insSubs = sortSubjectsByOrder(
        (ins.inscriptionSubjects || []).filter((is: any) => !is.subject?.subjectGroupId),
        (is: any) => is.subjectId,
        (is: any) => is.subject?.name || '',
        orderMap,
      );

      const subjects = insSubs.map((is: any) => {
        const termScores: Record<number, number> = {};
        terms.forEach((t: any) => { termScores[t.id] = 0; });

        (is.qualifications || []).forEach((q: any) => {
          if (q.isAbsent) return;
          const score = q.remedialScore != null && Number(q.remedialScore) > 0
            ? Number(q.remedialScore) : Number(q.score) || 0;
          const percentage = Number(q.evaluationPlan?.percentage) || 0;
          const termId = q.evaluationPlan?.termId;
          if (termId && termScores[termId] !== undefined) {
            termScores[termId] += score * (percentage / 100);
          }
        });

        (is.councilPoints || []).forEach((cp: any) => {
          const pVal = Number(cp.points) || 0;
          if (cp.termId && termScores[cp.termId] !== undefined) {
            termScores[cp.termId] += pVal;
          }
        });

        let finalScore: number | null = null;
        if (is.finalGrade && is.finalGrade.finalScore != null) {
          finalScore = Number(is.finalGrade.finalScore);
        } else {
          let total = 0;
          Object.values(termScores).forEach((v) => { total += v; });
          finalScore = Math.round((total / termCount) * 100) / 100;
        }

        return {
          id: is.subjectId,
          name: is.subject?.name || '',
          lapsos: terms.map((t: any) => ({
            termId: t.id,
            termName: t.name,
            score: Math.round((termScores[t.id] || 0) * 100) / 100,
          })),
          finalScore,
        };
      });

      return {
        periodName: ins.period?.name || ins.period?.period || '',
        gradeName: ins.grade?.name || '',
        sectionName: ins.section?.name || '',
        terms: terms.map((t: any) => ({ id: t.id, name: t.name, order: t.order })),
        subjects,
      };
    });

    const residence = (person as any).residence;

    res.json({
      institution: {
        code: settings.institution_dea_code || plantel?.code || '',
        name: settings.institution_name || plantel?.name || '',
        educationCode: settings.institution_code || '',
        educationType: settings.institution_level || '',
        address: settings.institution_address || '',
        municipality: settings.institution_municipality || plantel?.municipality || '',
        phone: settings.institution_phone || '',
        state: plantel?.state || '',
        cdcee: settings.institution_cdcee || '',
      },
      student: {
        id: person.id,
        firstName: person.firstName || '',
        lastName: person.lastName || '',
        document: person.document || '',
        birthdate: person.birthdate ? formatDateES(person.birthdate) : '',
        birthCountry: 'Venezuela',
        birthState: residence?.birthState || '',
        birthMunicipality: residence?.birthMunicipality || '',
      },
      expeditionDate: formatDateES(new Date()),
      years,
    });
  } catch (error: any) {
    console.error('[getCertifiedGradesData] Error:', error);
    res.status(500).json({ message: error.message || 'Error al obtener datos de notas certificadas' });
  }
};