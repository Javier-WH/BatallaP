import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import {
  Inscription,
  Person,
  PersonResidence,
  InscriptionSubject,
  Subject,
  SubjectFinalGrade,
  PeriodGrade,
  Term,
  Qualification,
  EvaluationPlan,
  CouncilPoint,
  SchoolPeriod,
  Grade,
  Section,
} from '@/models/index';
import {
  getSubjectOrderMap,
  sortSubjectsByOrder,
} from '@/services/subjectOrderService';

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

    // Sort subjects for each inscription and collect the unique subject list
    const subjectMap = new Map<number, { id: number; name: string; abbreviation: string | null }>();

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
          });
        }
      });
    });

    const allSubjects = Array.from(subjectMap.values());

    // Find EF subject (Educación Física) - match by name or abbreviation
    const efSubject = allSubjects.find(s =>
      s.name.toLowerCase().includes('educación física') ||
      s.name.toLowerCase().includes('educacion fisica') ||
      s.abbreviation?.toUpperCase() === 'EF'
    );

    // Other subjects (excluding EF)
    const otherSubjects = allSubjects.filter(s => s.id !== efSubject?.id);

    // Helper: calculate final score for an inscription subject
    const calculateFinalScore = (insSub: any): number | null => {
      // If SubjectFinalGrade exists, use it
      if (insSub.finalGrade && insSub.finalGrade.finalScore != null) {
        return Number(insSub.finalGrade.finalScore);
      }

      // Otherwise calculate from qualifications + council points
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

    // Build the Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Resumen de Rendimiento');

    // Column layout:
    // 1: Nro
    // 2: Apellidos
    // 3: Nombres
    // 4: Lugar de Nacimiento
    // 5: EF (Educación Física) - fixed column
    // 6: Día
    // 7: Mes
    // 8: Año
    // 9+: Other subjects (abbreviated headers)

    const fixedColCount = 8;
    const totalCols = fixedColCount + otherSubjects.length;
    const lastCol = sheet.getColumn(totalCols).letter;

    // Title rows
    sheet.mergeCells(`A1:${lastCol}1`);
    const titleCell = sheet.getCell('A1');
    titleCell.value = `Resumen de Rendimiento Estudiantil - ${grade.name} - Sección ${section.name}`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };

    sheet.mergeCells(`A2:${lastCol}2`);
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = `${period.name} (${period.period})`;
    subtitleCell.font = { size: 11 };
    subtitleCell.alignment = { horizontal: 'center' };

    // Header row (row 4)
    const headerRow = sheet.getRow(4);
    headerRow.getCell(1).value = 'Nro';
    headerRow.getCell(2).value = 'Apellidos';
    headerRow.getCell(3).value = 'Nombres';
    headerRow.getCell(4).value = 'Lugar de Nacimiento';
    headerRow.getCell(5).value = 'EF';
    headerRow.getCell(6).value = 'Día';
    headerRow.getCell(7).value = 'Mes';
    headerRow.getCell(8).value = 'Año';

    // Other subject columns with abbreviated headers
    otherSubjects.forEach((subj, idx) => {
      const col = fixedColCount + 1 + idx;
      const header = subj.abbreviation || subj.name;
      headerRow.getCell(col).value = header;
    });

    // Style header row
    headerRow.eachCell((cell: any) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
    });

    // Data rows
    let rowNum = 5;
    inscriptions.forEach((ins: any, index: number) => {
      const row = sheet.getRow(rowNum);
      const student = ins.student;
      const residence = student?.residence;

      // Nro
      row.getCell(1).value = index + 1;
      // Apellidos
      row.getCell(2).value = student?.lastName || '';
      // Nombres
      row.getCell(3).value = student?.firstName || '';
      // Lugar de Nacimiento (birthState + birthMunicipality)
      const birthPlace = residence
        ? `${residence.birthState || ''}, ${residence.birthMunicipality || ''}`.replace(/^,\s*|,\s*$/g, '').trim()
        : '';
      row.getCell(4).value = birthPlace;

      // EF score
      const insSubjects = sortSubjectsByOrder(
        ins.inscriptionSubjects || [],
        (is: any) => is.subjectId,
        (is: any) => is.subject?.name,
        subjectOrderMap
      );

      let efScore: number | null = null;
      if (efSubject) {
        const efInsSub = insSubjects.find((is: any) => is.subjectId === efSubject.id);
        if (efInsSub) {
          efScore = calculateFinalScore(efInsSub);
        }
      }
      row.getCell(5).value = efScore ?? '';
      row.getCell(5).numFmt = '0.00';
      row.getCell(5).alignment = { horizontal: 'center' };

      // Birth date split
      if (student?.birthdate) {
        const birthDate = new Date(student.birthdate);
        row.getCell(6).value = birthDate.getDate();
        row.getCell(7).value = birthDate.getMonth() + 1;
        row.getCell(8).value = birthDate.getFullYear();
      } else {
        row.getCell(6).value = '';
        row.getCell(7).value = '';
        row.getCell(8).value = '';
      }
      row.getCell(6).alignment = { horizontal: 'center' };
      row.getCell(7).alignment = { horizontal: 'center' };
      row.getCell(8).alignment = { horizontal: 'center' };

      // Other subjects scores
      otherSubjects.forEach((subj, idx) => {
        const col = fixedColCount + 1 + idx;
        const insSub = insSubjects.find((is: any) => is.subjectId === subj.id);
        if (insSub) {
          const score = calculateFinalScore(insSub);
          row.getCell(col).value = score ?? '';
          row.getCell(col).numFmt = '0.00';
        } else {
          row.getCell(col).value = '';
        }
        row.getCell(col).alignment = { horizontal: 'center' };
      });

      // Apply borders to all cells in the row
      for (let c = 1; c <= totalCols; c++) {
        row.getCell(c).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      }

      rowNum++;
    });

    // Column widths
    sheet.getColumn(1).width = 6;
    sheet.getColumn(2).width = 25;
    sheet.getColumn(3).width = 25;
    sheet.getColumn(4).width = 30;
    sheet.getColumn(5).width = 8;
    sheet.getColumn(6).width = 8;
    sheet.getColumn(7).width = 8;
    sheet.getColumn(8).width = 10;
    for (let i = fixedColCount + 1; i <= totalCols; i++) {
      sheet.getColumn(i).width = 10;
    }

    // Freeze panes (freeze header row and first 3 columns)
    sheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 4 }];

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
