const fs = require('fs');
const path = require('path');

const code = `import { Request, Response } from 'express';
import path from 'path';
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
import { readTemplateNamedRanges, TemplateNamedRanges } from '@/services/templateNamedRanges';

const gradeOrderToSheetName: Record<number, string> = {
  1: '1er Año',
  2: '1er Año',
  3: '3er Año',
  4: '4to Año',
  5: '5to Año',
};

const stateAbbreviations: Record<string, string> = {
  'GUARICO': 'GU',
  'MIRANDA': 'MI',
  'CARABOBO': 'CA',
  'ZULIA': 'ZU',
  'ARAGUA': 'AR',
  'BARINAS': 'BA',
  'BOLIVAR': 'BO',
  'COJEDES': 'CO',
  'PORTUGUESA': 'PO',
  'LARA': 'LA',
  'YARACUY': 'YA',
  'FALCON': 'FA',
  'VARGAS': 'VA',
  'MERIDA': 'ME',
  'TRUJILLO': 'TR',
  'TACHIRA': 'TA',
  'APURE': 'AP',
  'GUAIRA': 'GU',
  'NUEVA ESPARTA': 'NE',
  'SUCRE': 'SU',
  'ANZOATEGUI': 'AN',
  'MONAGAS': 'MO',
  'DELTA AMACURO': 'DA',
  'AMAZONAS': 'AM',
  'DISTRITO CAPITAL': 'DC',
  'DEPENDENCIAS FEDERALES': 'DF',
};

function getStateAbbrev(stateName: string): string {
  if (!stateName) return '';
  const upper = stateName.toUpperCase().trim();
  return stateAbbreviations[upper] || upper.substring(0, 2);
}

function padNumber(n: number | null | undefined): number | string | null {
  if (n == null) return null;
  if (n < 0) return n;
  if (n < 10) return '0' + n;
  return n;
}

async function getInstitutionSettings(): Promise<Record<string, string>> {
  const settings = await Setting.findAll();
  const map: Record<string, string> = {};
  settings.forEach((s: any) => { map[s.key] = s.value; });
  return map;
}

const MAX_STUDENTS_PER_SHEET = 35;

function cloneWorksheet(workbook: ExcelJS.Workbook, sourceSheet: ExcelJS.Worksheet, newName: string): ExcelJS.Worksheet {
  const newSheet = workbook.addWorksheet(newName, {
    properties: sourceSheet.model.properties,
    views: sourceSheet.model.views,
  });

  sourceSheet.eachRow({ includeEmpty: true }, (row, rowNum) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const newCell = newSheet.getRow(rowNum).getCell(colNumber);
      newCell.value = cell.value;
      if (cell.style) {
        newCell.style = JSON.parse(JSON.stringify(cell.style));
      }
    });
  });

  if (sourceSheet.model.merges) {
    sourceSheet.model.merges.forEach((merge: string) => {
      newSheet.mergeCells(merge);
    });
  }

  return newSheet;
}

function fillSheetByNamedRanges(
  sheet: ExcelJS.Worksheet,
  sheetName: string,
  namedRanges: TemplateNamedRanges,
  settings: Record<string, string>,
  plantel: any,
  period: any,
  students: any[],
  academicSubjects: any[],
  groupedSubjectIds: Set<number>,
  subjectColList: { col: number; abbr: string }[],
  subjectToSubjIndex: Map<number, number>,
  calculateFinalScore: (insSub: any) => number | null,
  subjectOrderMap: Map<number, number>,
  studentOffset: number,
): void {
  const setByRange = (name: string, value: any) => {
    const ref = namedRanges.getCell(sheetName, name);
    if (ref) {
      sheet.getCell(ref.cell).value = value;
    }
  };

  setByRange('inst_period', period?.name || '');
  setByRange('inst_eval_type', 'REVISION DE MATERIA PENDIENTE');
  setByRange('inst_code', settings.institution_dea_code || plantel?.code || '');
  setByRange('inst_name', settings.institution_name || plantel?.name || '');
  setByRange('inst_address', settings.institution_address || '');
  setByRange('inst_phone', settings.institution_phone || '');
  setByRange('inst_municipality', plantel?.municipality || '');
  setByRange('inst_state', plantel?.state || '');
  setByRange('inst_cdcee', settings.institution_cdcee || '');
  setByRange('inst_director', settings.director_name || '');
  setByRange('inst_director_doc', settings.director_document || '');

  for (let n = 1; n <= MAX_STUDENTS_PER_SHEET; n++) {
    const studentIdx = studentOffset + (n - 1);
    const ins = students[studentIdx];

    if (!ins) {
      const blankFields = ['std_num', 'std_doc', 'std_ln', 'std_fn', 'std_bp', 'std_ef', 'std_sx', 'std_bd', 'std_bm', 'std_by', 'std_part'];
      for (const f of blankFields) {
        setByRange(f + '_' + n, '');
      }
      for (let i = 1; i <= subjectColList.length; i++) {
        setByRange('grade_' + i + '_' + n, '');
      }
      continue;
    }

    const student = ins.student;
    const residence = student?.residence;

    setByRange('std_num_' + n, String(studentIdx + 1).padStart(2, '0'));

    const docType = student?.documentType === 'Venezolano' ? 'V' :
                    student?.documentType === 'Extranjero' ? 'E' :
                    student?.documentType === 'Pasaporte' ? 'P' : 'V';
    setByRange('std_doc_' + n, docType + ' ' + (student?.document || ''));
    setByRange('std_ln_' + n, student?.lastName || '');
    setByRange('std_fn_' + n, student?.firstName || '');
    setByRange('std_bp_' + n, residence?.birthMunicipality || '');
    setByRange('std_ef_' + n, getStateAbbrev(residence?.birthState || ''));
    setByRange('std_sx_' + n, student?.gender || '');

    if (student?.birthdate) {
      const birthDate = new Date(student.birthdate);
      setByRange('std_bd_' + n, padNumber(birthDate.getDate()));
      setByRange('std_bm_' + n, padNumber(birthDate.getMonth() + 1));
      setByRange('std_by_' + n, birthDate.getFullYear());
    }

    const insSubjects = sortSubjectsByOrder(
      ins.inscriptionSubjects || [],
      (is: any) => is.subjectId,
      (is: any) => is.subject?.name,
      subjectOrderMap
    );

    for (let i = 0; i < subjectColList.length; i++) {
      const subjId = subjectToSubjIndex.get(i + 1);
      if (!subjId) {
        setByRange('grade_' + (i + 1) + '_' + n, '');
        continue;
      }
      const insSub = insSubjects.find((is: any) => is.subjectId === subjId);
      const score = insSub ? calculateFinalScore(insSub) : null;
      setByRange('grade_' + (i + 1) + '_' + n, score != null ? padNumber(score) : '');
    }

    const groupedInsSub = insSubjects.find((is: any) =>
      groupedSubjectIds.has(is.subjectId)
    );
    setByRange('std_part_' + n, groupedInsSub?.subject?.name || '');
  }
}

export const exportPerformanceSummary = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId, gradeId, sectionId } = req.query;

    if (!schoolPeriodId || !gradeId || !sectionId) {
      return res.status(400).json({ message: 'schoolPeriodId, gradeId y sectionId son requeridos' });
    }

    const period = await SchoolPeriod.findByPk(Number(schoolPeriodId));
    if (!period) return res.status(404).json({ message: 'Periodo no encontrado' });

    const grade = await Grade.findByPk(Number(gradeId));
    if (!grade) return res.status(404).json({ message: 'Grado no encontrado' });

    const section = await Section.findByPk(Number(sectionId));
    if (!section) return res.status(404).json({ message: 'Seccion no encontrada' });

    const gradeOrder = grade.order || 1;
    const sheetName = gradeOrderToSheetName[gradeOrder] || '1er Año';

    const pg = await PeriodGrade.findOne({
      where: { schoolPeriodId: Number(schoolPeriodId), gradeId: Number(gradeId) },
    });

    if (!pg) return res.status(404).json({ message: 'Estructura academica no encontrada' });

    const terms = await Term.findAll({
      where: { schoolPeriodId: Number(schoolPeriodId) },
      raw: true,
    });
    const termCount = terms.length || 1;

    const settings = await getInstitutionSettings();

    let plantel: any = null;
    if (settings.institution_dea_code) {
      plantel = await Plantel.findOne({ where: { code: settings.institution_dea_code } });
    }

    const inscriptions = await Inscription.findAll({
      where: {
        schoolPeriodId: Number(schoolPeriodId),
        sectionId: Number(sectionId),
        gradeId: Number(gradeId),
      },
      include: [
        {
          model: Person,
          as: 'student',
          include: [
            { model: PersonResidence, as: 'residence' },
          ],
        },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          include: [
            { model: Subject, as: 'subject', include: [{ model: SubjectGroup, as: 'subjectGroup' }] },
            { model: SubjectFinalGrade, as: 'finalGrade', required: false },
            { model: Qualification, as: 'qualifications', include: [{ model: EvaluationPlan, as: 'evaluationPlan' }], required: false },
            { model: CouncilPoint, as: 'councilPoints', required: false },
          ],
        },
      ],
      order: [
        [{ model: Person, as: 'student' }, 'lastName', 'ASC'],
        [{ model: Person, as: 'student' }, 'firstName', 'ASC'],
      ],
    });

    if (inscriptions.length === 0) {
      return res.status(404).json({ message: 'No hay estudiantes inscritos en esta seccion' });
    }

    const subjectOrderMap = await getSubjectOrderMap(pg.id);

    const subjectMap = new Map<number, { id: number; name: string; abbreviation: string | null; subjectGroupId: number | null; subjectGroupName: string | null }>();

    inscriptions.forEach((ins: any) => {
      const sorted = sortSubjectsByOrder(
        ins.inscriptionSubjects || [],
        (is: any) => is.subjectId,
        (is: any) => is.subject?.name,
        subjectOrderMap
      );
      sorted.forEach((is: any) => {
        if (is.subject && !subjectMap.has(is.subjectId)) {
          subjectMap.set(is.subjectId, {
            id: is.subject.id,
            name: is.subject.name,
            abbreviation: is.subject.abbreviation || null,
            subjectGroupId: is.subject.subjectGroupId || null,
            subjectGroupName: is.subject.subjectGroup?.name || null,
          });
        }
      });
    });

    const allSubjects = Array.from(subjectMap.values());

    const groupedSubjectIds = new Set(
      allSubjects.filter(s => s.subjectGroupId !== null).map(s => s.id)
    );

    const academicSubjects = allSubjects.filter(s => !groupedSubjectIds.has(s.id));

    const calculateFinalScore = (insSub: any): number | null => {
      if (insSub.finalGrade && insSub.finalGrade.finalScore != null) {
        return Number(insSub.finalGrade.finalScore);
      }

      const termScores: Record<number, number> = {};
      terms.forEach((t: any) => { termScores[t.id] = 0; });

      (insSub.qualifications || []).forEach((q: any) => {
        if (q.isAbsent) return;
        const score = q.remedialScore != null && Number(q.remedialScore) > 0
          ? Number(q.remedialScore)
          : Number(q.score) || 0;
        const percentage = Number(q.evaluationPlan?.percentage) || 0;
        const termId = q.evaluationPlan?.termId;
        if (termId && termScores[termId] !== undefined) {
          termScores[termId] += score * (percentage / 100);
        }
      });

      (insSub.councilPoints || []).forEach((cp: any) => {
        const pVal = Number(cp.points) || 0;
        if (cp.termId && termScores[cp.termId] !== undefined) {
          termScores[cp.termId] += pVal;
        }
      });

      let totalAccumulated = 0;
      Object.values(termScores).forEach(val => totalAccumulated += val);

      const finalScore = totalAccumulated / termCount;
      return Math.round(finalScore * 100) / 100;
    };

    const templatePath = path.resolve(process.cwd(), 'templates/ResumenFinal_Template.xlsx');

    const namedRanges = readTemplateNamedRanges(templatePath);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    let sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
      sheet = workbook.worksheets[0];
    }
    const actualSheetName = sheet!.name;

    // Discover subject columns from named ranges
    const subjectColList: { col: number; abbr: string }[] = [];
    let subjIdx = 1;
    while (true) {
      const ref = namedRanges.getCell(actualSheetName, 'subj_' + subjIdx);
      if (!ref) break;
      const cellValue = sheet!.getCell(ref.cell).value;
      const abbr = (typeof cellValue === 'string' ? cellValue.trim() : String(cellValue || '')).toUpperCase();
      if (abbr) {
        subjectColList.push({ col: ref.col, abbr });
      }
      subjIdx++;
    }

    // Map academic subjects to subject column indices by abbreviation
    const subjectToSubjIndex = new Map<number, number>();
    for (let i = 0; i < subjectColList.length; i++) {
      const matchingSubject = academicSubjects.find(s =>
        s.abbreviation && s.abbreviation.toUpperCase() === subjectColList[i].abbr
      );
      if (matchingSubject) {
        subjectToSubjIndex.set(matchingSubject.id, i + 1);
      }
    }

    // For academic subjects without a matching template column, append after last subject
    const maxSubjCol = subjectColList.length > 0
      ? Math.max(...subjectColList.map(s => s.col))
      : 13;
    let nextCol = maxSubjCol + 1;
    for (const subj of academicSubjects) {
      if (!subjectToSubjIndex.has(subj.id)) {
        const newSubjIdx = subjectColList.length + 1;
        subjectColList.push({ col: nextCol, abbr: (subj.abbreviation || subj.name).toUpperCase() });
        subjectToSubjIndex.set(subj.id, newSubjIdx);

        const headerCell = sheet!.getRow(15).getCell(nextCol);
        headerCell.value = subj.abbreviation || subj.name;
        headerCell.font = { bold: true, size: 8 };
        headerCell.alignment = { horizontal: 'center' };

        const refCol = nextCol - 1;
        const refHeaderCell = sheet!.getRow(15).getCell(refCol);
        if (refHeaderCell.border) {
          headerCell.border = JSON.parse(JSON.stringify(refHeaderCell.border));
        }
        for (let r = 16; r <= 16 + MAX_STUDENTS_PER_SHEET; r++) {
          const dataCell = sheet!.getRow(r).getCell(nextCol);
          const refDataCell = sheet!.getRow(r).getCell(refCol);
          if (refDataCell.border) {
            dataCell.border = JSON.parse(JSON.stringify(refDataCell.border));
          }
        }

        nextCol++;
      }
    }

    const totalSheets = Math.ceil(inscriptions.length / MAX_STUDENTS_PER_SHEET);

    fillSheetByNamedRanges(
      sheet!, actualSheetName, namedRanges, settings, plantel, period,
      inscriptions, academicSubjects, groupedSubjectIds,
      subjectColList, subjectToSubjIndex,
      calculateFinalScore, subjectOrderMap, 0,
    );

    for (let sheetNum = 1; sheetNum < totalSheets; sheetNum++) {
      const newSheetName = actualSheetName + ' (' + (sheetNum + 1) + ')';
      const clonedSheet = cloneWorksheet(workbook, sheet!, newSheetName);

      fillSheetByNamedRanges(
        clonedSheet, actualSheetName, namedRanges, settings, plantel, period,
        inscriptions, academicSubjects, groupedSubjectIds,
        subjectColList, subjectToSubjIndex,
        calculateFinalScore, subjectOrderMap, sheetNum * MAX_STUDENTS_PER_SHEET,
      );
    }

    // Remove other worksheets
    const filledSheetNames = new Set([actualSheetName]);
    for (let i = 1; i < totalSheets; i++) {
      filledSheetNames.add(actualSheetName + ' (' + (i + 1) + ')');
    }
    const sheetsToRemove = workbook.worksheets.filter(ws => !filledSheetNames.has(ws.name));
    sheetsToRemove.forEach(ws => workbook.removeWorksheet(ws.id!));

    const buffer = await workbook.xlsx.writeBuffer();

    const fileName = 'resumen-rendimiento-' + grade.name.replace(/\s+/g, '_') + '-' + section.name.replace(/\s+/g, '_') + '.xlsx';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="' + fileName + '"');
    res.send(buffer);
  } catch (error: any) {
    console.error('[exportPerformanceSummary] Error:', error);
    res.status(500).json({ message: error.message || 'Error al exportar resumen de rendimiento' });
  }
};
`;

fs.writeFileSync(path.resolve(process.cwd(), 'src/controllers/performanceSummaryController.ts'), code, 'utf8');
console.log('Controller written:', code.split(/\n/).length, 'lines');