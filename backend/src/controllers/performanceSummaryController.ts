import { Request, Response } from 'express';
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

// Map grade order to template sheet name
const gradeOrderToSheetName: Record<number, string> = {
  1: '1er Año',
  2: '1er Año', // 2nd year uses same template as 1st year
  3: '3er Año',
  4: '4to Año',
  5: '5to Año',
};

// Venezuelan state abbreviations
const stateAbbreviations: Record<string, string> = {
  'GUÁRICO': 'GU',
  'MIRANDA': 'MI',
  'CARABOBO': 'CA',
  'ZULIA': 'ZU',
  'ARAGUA': 'AR',
  'BARINAS': 'BA',
  'BOLÍVAR': 'BO',
  'COJEDES': 'CO',
  'PORTUGUESA': 'PO',
  'LARA': 'LA',
  'YARACUY': 'YA',
  'FALCÓN': 'FA',
  'VARGAS': 'VA',
  'MÉRIDA': 'ME',
  'TRUJILLO': 'TR',
  'TÁCHIRA': 'TA',
  'APURE': 'AP',
  'GUÁIRA': 'GU',
  'NUEVA ESPARTA': 'NE',
  'SUCRE': 'SU',
  'ANZOÁTEGUI': 'AN',
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
  if (n < 10) return `0${n}`;
  return n;
}

async function getInstitutionSettings(): Promise<Record<string, string>> {
  const settings = await Setting.findAll();
  const map: Record<string, string> = {};
  settings.forEach((s: any) => { map[s.key] = s.value; });
  return map;
}

export const exportPerformanceSummary = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId, gradeId, sectionId } = req.query;

    if (!schoolPeriodId || !gradeId || !sectionId) {
      return res.status(400).json({ message: 'schoolPeriodId, gradeId y sectionId son requeridos' });
    }

    const period = await SchoolPeriod.findByPk(Number(schoolPeriodId));
    if (!period) return res.status(404).json({ message: 'Período no encontrado' });

    const grade = await Grade.findByPk(Number(gradeId));
    if (!grade) return res.status(404).json({ message: 'Grado no encontrado' });

    const section = await Section.findByPk(Number(sectionId));
    if (!section) return res.status(404).json({ message: 'Sección no encontrada' });

    // Determine which template sheet to use
    const gradeOrder = grade.order || 1;
    const sheetName = gradeOrderToSheetName[gradeOrder] || '1er Año';

    // Get PeriodGrade for subject ordering
    const pg = await PeriodGrade.findOne({
      where: { schoolPeriodId: Number(schoolPeriodId), gradeId: Number(gradeId) },
    });

    if (!pg) return res.status(404).json({ message: 'Estructura académica no encontrada' });

    // Get all terms for this period (for final grade calculation)
    const terms = await Term.findAll({
      where: { schoolPeriodId: Number(schoolPeriodId) },
      raw: true,
    });
    const termCount = terms.length || 1;

    // Get institution settings
    const settings = await getInstitutionSettings();

    // Get Plantel info
    let plantel: any = null;
    if (settings.institution_dea_code) {
      plantel = await Plantel.findOne({ where: { code: settings.institution_dea_code } });
    }

    // Get all inscriptions for this section/grade/period
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
            {
              model: PersonResidence,
              as: 'residence',
            },
          ],
        },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          include: [
            {
              model: Subject,
              as: 'subject',
              include: [{ model: SubjectGroup, as: 'subjectGroup' }],
            },
            {
              model: SubjectFinalGrade,
              as: 'finalGrade',
              required: false,
            },
            {
              model: Qualification,
              as: 'qualifications',
              include: [{ model: EvaluationPlan, as: 'evaluationPlan' }],
              required: false,
            },
            {
              model: CouncilPoint,
              as: 'councilPoints',
              required: false,
            },
          ],
        },
      ],
      order: [
        [{ model: Person, as: 'student' }, 'lastName', 'ASC'],
        [{ model: Person, as: 'student' }, 'firstName', 'ASC'],
      ],
    });

    if (inscriptions.length === 0) {
      return res.status(404).json({ message: 'No hay estudiantes inscritos en esta sección' });
    }

    // Get subject order map
    const subjectOrderMap = await getSubjectOrderMap(pg.id);

    // Collect all unique subjects across all inscriptions (ordered)
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

    // Identify grouped subjects (subjects that belong to a SubjectGroup - these are participation subjects)
    const groupedSubjectIds = new Set(
      allSubjects.filter(s => s.subjectGroupId !== null).map(s => s.id)
    );

    // Non-grouped subjects = regular academic subjects (go in the ÁREAS DE FORMACIÓN columns)
    const academicSubjects = allSubjects.filter(s => !groupedSubjectIds.has(s.id));

    // Helper: calculate final score for an inscription subject
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

    // Read the template file
    const templatePath = path.resolve(process.cwd(), 'templates/ResumenFinal_Template.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    // Get the appropriate worksheet
    let sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
      // Fallback: use first worksheet
      sheet = workbook.worksheets[0];
    }

    // Remove other worksheets - keep only the one we need
    const sheetsToRemove = workbook.worksheets.filter(ws => ws.name !== sheet!.name);
    sheetsToRemove.forEach(ws => workbook.removeWorksheet(ws.id!));

    // Fill institution data (rows 1-10)
    // Row 3: Año Escolar (cols 13-15 merged)
    if (period.name) {
      sheet.getCell('M3').value = period.name;
    }

    // Row 4: Tipo de Evaluación (cols 14-15 merged)
    sheet.getCell('N4').value = 'REVISIÓN DE MATERIA PENDIENTE';

    // Row 7: Código de Institución + Denominación
    if (settings.institution_dea_code || plantel?.code) {
      sheet.getCell('C7').value = settings.institution_dea_code || plantel?.code || '';
    }
    const institutionName = settings.institution_name || plantel?.name || '';
    if (institutionName) {
      sheet.getCell('I7').value = institutionName;
    }

    // Row 8: Dirección
    if (settings.institution_address) {
      sheet.getCell('C8').value = settings.institution_address;
    }

    // Row 9: Municipio + Entidad Federal + CDCEE
    if (plantel?.municipality) {
      sheet.getCell('C9').value = plantel.municipality;
    }
    if (plantel?.state) {
      sheet.getCell('G9').value = plantel.state;
    }
    if (settings.institution_cdcee) {
      sheet.getCell('N9').value = settings.institution_cdcee;
    }

    // Row 10: Director + Cédula
    if (settings.director_name) {
      sheet.getCell('C10').value = settings.director_name;
    }
    if (settings.director_document) {
      sheet.getCell('N10').value = settings.director_document;
    }

    // Row 8: Teléfono
    if (settings.institution_phone) {
      sheet.getCell('U8').value = settings.institution_phone;
    }

    // Now fill the subject headers in row 15 (columns 14+)
    // The template already has fixed abbreviation headers (CA, ILE, MA, etc.)
    // We need to map our academic subjects to those columns by abbreviation
    const r15 = sheet.getRow(15);
    const templateSubjectCols: { col: number; abbreviation: string }[] = [];
    for (let c = 14; c <= sheet.columnCount; c++) {
      const v = r15.getCell(c).value;
      if (v && typeof v === 'string' && v.trim().length > 0 && v !== 'PARTICIPACIÓN EN GRUPOS DE CREACIÓN, RECREACIÓN Y PRODUCCIÓN') {
        templateSubjectCols.push({ col: c, abbreviation: v.trim().toUpperCase() });
      }
    }

    // Map academic subjects to template columns by abbreviation
    const subjectToColMap = new Map<number, number>();
    for (const tmplCol of templateSubjectCols) {
      const matchingSubject = academicSubjects.find(s =>
        s.abbreviation && s.abbreviation.toUpperCase() === tmplCol.abbreviation
      );
      if (matchingSubject) {
        subjectToColMap.set(matchingSubject.id, tmplCol.col);
      }
    }

    // For academic subjects without a matching template column, we'll try to place them
    // in unused template columns or append after the last subject column
    const usedCols = new Set(templateSubjectCols.map(t => t.col));
    let nextAvailableCol = templateSubjectCols.length > 0
      ? Math.max(...templateSubjectCols.map(t => t.col)) + 1
      : 14;

    for (const subj of academicSubjects) {
      if (!subjectToColMap.has(subj.id)) {
        // Find next unused template column
        while (usedCols.has(nextAvailableCol)) nextAvailableCol++;
        subjectToColMap.set(subj.id, nextAvailableCol);
        usedCols.add(nextAvailableCol);
        // Write the abbreviation header
        const cell = sheet.getRow(15).getCell(nextAvailableCol);
        cell.value = subj.abbreviation || subj.name;
        cell.font = { bold: true, size: 8 };
        cell.alignment = { horizontal: 'center' };
        // Copy borders from the previous template column
        const refCol = nextAvailableCol - 1;
        const refHeaderCell = sheet.getRow(15).getCell(refCol);
        if (refHeaderCell.border) {
          cell.border = JSON.parse(JSON.stringify(refHeaderCell.border));
        }
        // Apply borders to data rows (16+) for this new column
        for (let r = 16; r <= 16 + inscriptions.length; r++) {
          const dataCell = sheet.getRow(r).getCell(nextAvailableCol);
          const refDataCell = sheet.getRow(r).getCell(refCol);
          if (refDataCell.border) {
            dataCell.border = JSON.parse(JSON.stringify(refDataCell.border));
          }
        }
      }
    }

    // Find the PARTICIPACIÓN column (last content column in row 15)
    let participationCol = sheet.columnCount;
    for (let c = sheet.columnCount; c >= 14; c--) {
      const v = r15.getCell(c).value;
      if (v && typeof v === 'string' && v.includes('PARTICIPACIÓN')) {
        participationCol = c;
        break;
      }
    }

    // Fill student data rows (starting at row 16)
    let rowNum = 16;
    inscriptions.forEach((ins: any, index: number) => {
      const row = sheet.getRow(rowNum);
      const student = ins.student;
      const residence = student?.residence;

      // Col 1: N°
      row.getCell(1).value = String(index + 1).padStart(2, '0');

      // Col 2-3: Cédula de Identidad (merged B-C)
      const docType = student?.documentType === 'Venezolano' ? 'V' :
                      student?.documentType === 'Extranjero' ? 'E' :
                      student?.documentType === 'Pasaporte' ? 'P' : 'V';
      row.getCell(2).value = `${docType} ${student?.document || ''}`;

      // Col 4-5: Apellidos (merged D-E)
      row.getCell(4).value = student?.lastName || '';

      // Col 6-7: Nombres (merged F-G)
      row.getCell(6).value = student?.firstName || '';

      // Col 8: Lugar de Nacimiento (municipality)
      row.getCell(8).value = residence?.birthMunicipality || '';

      // Col 9: EF (Entidad Federal - state abbreviation)
      row.getCell(9).value = getStateAbbrev(residence?.birthState || '');

      // Col 10: SEXO
      row.getCell(10).value = student?.gender || '';

      // Col 11-13: Fecha de Nacimiento (Día, Mes, Año)
      if (student?.birthdate) {
        const birthDate = new Date(student.birthdate);
        row.getCell(11).value = padNumber(birthDate.getDate());
        row.getCell(12).value = padNumber(birthDate.getMonth() + 1);
        row.getCell(13).value = birthDate.getFullYear();
      }

      // Sort inscription subjects
      const insSubjects = sortSubjectsByOrder(
        ins.inscriptionSubjects || [],
        (is: any) => is.subjectId,
        (is: any) => is.subject?.name,
        subjectOrderMap
      );

      // Fill subject grades
      for (const subj of academicSubjects) {
        const col = subjectToColMap.get(subj.id);
        if (!col) continue;

        const insSub = insSubjects.find((is: any) => is.subjectId === subj.id);
        if (insSub) {
          const score = calculateFinalScore(insSub);
          row.getCell(col).value = score != null ? padNumber(score) : '';
        } else {
          row.getCell(col).value = '';
        }
      }

      // Fill PARTICIPACIÓN column with grouped subject name
      const groupedInsSub = insSubjects.find((is: any) =>
        groupedSubjectIds.has(is.subjectId)
      );
      if (groupedInsSub) {
        row.getCell(participationCol).value = groupedInsSub.subject?.name || '';
      } else {
        row.getCell(participationCol).value = '';
      }

      rowNum++;
    });

    // Ensure all subject columns (header + data rows) have borders
    // Some template columns may lack borders (e.g. Educación Física)
    // We copy border style from a known-good adjacent column
    const allSubjectCols = Array.from(new Set([...subjectToColMap.values()]));
    if (allSubjectCols.length > 0) {
      // Find a reference column with borders (use col 13 or the first subject col - 1)
      const refCol = allSubjectCols[0] > 13 ? allSubjectCols[0] - 1 : 13;
      const refHeaderBorder = sheet.getRow(15).getCell(refCol).border;
      for (const col of allSubjectCols) {
        const headerCell = sheet.getRow(15).getCell(col);
        if (!headerCell.border || (!headerCell.border.top && !headerCell.border.bottom)) {
          if (refHeaderBorder) {
            headerCell.border = JSON.parse(JSON.stringify(refHeaderBorder));
          }
        }
        for (let r = 16; r < rowNum; r++) {
          const dataCell = sheet.getRow(r).getCell(col);
          if (!dataCell.border || (!dataCell.border.top && !dataCell.border.bottom)) {
            const refBorder = sheet.getRow(r).getCell(refCol).border;
            if (refBorder) {
              dataCell.border = JSON.parse(JSON.stringify(refBorder));
            }
          }
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();

    const fileName = `resumen-rendimiento-${grade.name.replace(/\s+/g, '_')}-${section.name.replace(/\s+/g, '_')}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('[exportPerformanceSummary] Error:', error);
    res.status(500).json({ message: error.message || 'Error al exportar resumen de rendimiento' });
  }
};
