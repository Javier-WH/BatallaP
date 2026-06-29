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

  // Copy column widths
  if (sourceSheet.columns) {
    sourceSheet.columns.forEach((col, idx) => {
      if (col && col.width != null) {
        newSheet.getColumn(idx + 1).width = col.width;
      }
    });
  }

  // Copy cell values, styles and row heights
  sourceSheet.eachRow({ includeEmpty: true }, (row, rowNum) => {
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const newCell = newSheet.getRow(rowNum).getCell(colNumber);
      newCell.value = cell.value;
      if (cell.style) {
        newCell.style = JSON.parse(JSON.stringify(cell.style));
      }
      if (cell.numFmt) {
        newCell.numFmt = cell.numFmt;
      }
      if (cell.font) {
        newCell.font = JSON.parse(JSON.stringify(cell.font));
      }
      if (cell.alignment) {
        newCell.alignment = JSON.parse(JSON.stringify(cell.alignment));
      }
      if (cell.border) {
        newCell.border = JSON.parse(JSON.stringify(cell.border));
      }
      if (cell.fill) {
        newCell.fill = JSON.parse(JSON.stringify(cell.fill));
      }
    });
    if (row.height != null) {
      newSheet.getRow(rowNum).height = row.height;
    }
  });

  // Copy merged cell ranges
  if (sourceSheet.model.merges) {
    sourceSheet.model.merges.forEach((merge: string) => {
      newSheet.mergeCells(merge);
    });
  }

  // Copy page setup and print options if present
  if (sourceSheet.pageSetup) {
    newSheet.pageSetup = JSON.parse(JSON.stringify(sourceSheet.pageSetup));
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
  // Only writes when value is non-empty. Empty/undefined values leave the
  // cell untouched, preserving the template's decorative content (e.g. "***"
  // placeholders) for unused student rows.
  const setByRange = (name: string, value: any) => {
    if (value === undefined || value === null || value === '') return;
    const ref = namedRanges.getCell(sheetName, name);
    if (ref) {
      sheet.getCell(ref.cell).value = value;
    }
  };

  setByRange('inst_period', period?.name);
  setByRange('inst_eval_type', 'REVISION DE MATERIA PENDIENTE');
  setByRange('inst_code', settings.institution_dea_code || plantel?.code);
  setByRange('inst_name', settings.institution_name || plantel?.name);
  setByRange('inst_address', settings.institution_address);
  setByRange('inst_phone', settings.institution_phone);
  setByRange('inst_municipality', settings.institution_municipality || plantel?.municipality);
  setByRange('inst_state', plantel?.state);
  setByRange('inst_cdcee', settings.institution_cdcee);
  setByRange('inst_director', settings.director_name);
  setByRange('inst_director_doc', settings.director_document);

  for (let n = 1; n <= MAX_STUDENTS_PER_SHEET; n++) {
    const studentIdx = studentOffset + (n - 1);
    const ins = students[studentIdx];

    // If no student for this row, do nothing — keep the template's placeholder
    // (e.g. "***") intact.
    if (!ins) continue;

    const student = ins.student;
    const residence = student?.residence;

    setByRange('std_num_' + n, String(studentIdx + 1).padStart(2, '0'));

    const docType = student?.documentType === 'Venezolano' ? 'V' :
                    student?.documentType === 'Extranjero' ? 'E' :
                    student?.documentType === 'Pasaporte' ? 'P' : 'V';
    setByRange('std_doc_' + n, docType + ' ' + (student?.document || ''));
    setByRange('std_ln_' + n, student?.lastName);
    setByRange('std_fn_' + n, student?.firstName);
    setByRange('std_bp_' + n, residence?.birthMunicipality);
    setByRange('std_ef_' + n, getStateAbbrev(residence?.birthState || ''));
    setByRange('std_sx_' + n, student?.gender);

    if (student?.birthdate) {
      const birthDate = new Date(student.birthdate);
      setByRange('std_bd_' + n, padNumber(birthDate.getDate()));
      setByRange('std_bm_' + n, padNumber(birthDate.getMonth() + 1));
      setByRange('std_by_' + n, padNumber(birthDate.getFullYear() % 100));
    }

    const insSubjects = sortSubjectsByOrder(
      ins.inscriptionSubjects || [],
      (is: any) => is.subjectId,
      (is: any) => is.subject?.name,
      subjectOrderMap
    );

    for (let i = 0; i < subjectColList.length; i++) {
      const subjId = subjectToSubjIndex.get(i + 1);
      if (!subjId) continue;
      const insSub = insSubjects.find((is: any) => is.subjectId === subjId);
      const score = insSub ? calculateFinalScore(insSub) : null;
      if (score != null) {
        setByRange('grade_' + (i + 1) + '_' + n, padNumber(score));
      }
    }

    const groupedInsSub = insSubjects.find((is: any) =>
      groupedSubjectIds.has(is.subjectId)
    );
    if (groupedInsSub?.subject?.name) {
      setByRange('std_part_' + n, groupedInsSub.subject.name);
    }
  }
}

export const exportPerformanceSummary = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId, gradeId, sectionId, template } = req.query;

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

    // Resolve template path. Precedence:
//   1. ?template= override in the query string
//   2. Template assigned to the (grade, section) combination
//   3. Template assigned to the grade (any section)
//   4. The default ResumenFinal_Template.xlsx shipped in the repository
    const templatesRoot = path.resolve(process.cwd(), 'templates');
    let templatePath: string;
    if (template && typeof template === 'string') {
      const requested = path.basename(template);
      const candidate = path.join(templatesRoot, requested);
      if (!candidate.startsWith(templatesRoot) || !fs.existsSync(candidate)) {
        return res.status(404).json({ message: 'La plantilla seleccionada no existe' });
      }
      templatePath = candidate;
    } else {
      // Look up the template assigned to this grade / section
      const { Setting } = await import('@/models/index');
      const tryKey = (k: string) => Setting.findOne({ where: { key: k } });
      const gradeId = String(grade.id);
      const sectionId = section.id;
      const sectionKey = `template_assignment:grade:${gradeId}:section:${sectionId}`;
      const gradeKey = `template_assignment:grade:${gradeId}`;
      const sectionAssignment = await tryKey(sectionKey);
      const gradeAssignment = sectionAssignment ? null : await tryKey(gradeKey);
      const assignment = sectionAssignment || gradeAssignment;
      if (assignment && fs.existsSync(path.join(templatesRoot, path.basename(assignment.value)))) {
        templatePath = path.join(templatesRoot, path.basename(assignment.value));
      } else {
        templatePath = path.resolve(templatesRoot, 'ResumenFinal_Template.xlsx');
        if (!fs.existsSync(templatePath)) {
          return res.status(404).json({ message: 'No hay plantilla configurada. Sube una plantilla desde la gestión de resumen.' });
        }
      }
    }

    const namedRanges = readTemplateNamedRanges(templatePath);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templatePath);

    let sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
      sheet = workbook.worksheets[0];
    }
    const actualSheetName = sheet!.name;

    // Sort academic subjects by canonical order (subjectOrderMap) so subj_i
    // always maps to the same subject regardless of insertion order.
    const sortedAcademicSubjects = [...academicSubjects].sort((a, b) => {
      const orderA = subjectOrderMap.get(a.id) ?? 999;
      const orderB = subjectOrderMap.get(b.id) ?? 999;
      return orderA - orderB;
    });

    // Discover subj_i named ranges and WRITE the abbreviation of the i-th
    // subject (in canonical order) into that cell. The map is subjIndex → subjectId
    // so that fillSheetByNamedRanges can look up which subject a column belongs to.
    const subjectColList: { col: number; abbr: string }[] = [];
    const subjectToSubjIndex = new Map<number, number>();
    let subjIdx = 1;
    while (true) {
      const ref = namedRanges.getCell(actualSheetName, 'subj_' + subjIdx);
      if (!ref) break;
      const subj = sortedAcademicSubjects[subjIdx - 1];
      if (subj) {
        const abbrText = subj.abbreviation || subj.name;
        sheet!.getCell(ref.cell).value = abbrText;
        subjectColList.push({ col: ref.col, abbr: abbrText.toUpperCase() });
        subjectToSubjIndex.set(subjIdx, subj.id);
        // Also write the full subject name into subjname_i if defined
        const nameRef = namedRanges.getCell(actualSheetName, 'subjname_' + subjIdx);
        if (nameRef) {
          sheet!.getCell(nameRef.cell).value = subj.name;
        }
      }
      subjIdx++;
    }

    // For academic subjects without a subj_i named range, append after last subject.
    // IMPORTANT: only auto-append columns for the default shipped template. Custom user
    // templates must be respected strictly: missing subj_i named ranges means those
    // subjects simply won't be rendered (avoids corrupting the user's layout).
    const isDefaultTemplate = path.basename(templatePath).toLowerCase() === 'resumenfinal_template.xlsx';
    if (isDefaultTemplate) {
      const maxSubjCol = subjectColList.length > 0
        ? Math.max(...subjectColList.map(s => s.col))
        : 13;
      let nextCol = maxSubjCol + 1;
      for (const subj of sortedAcademicSubjects) {
        if (![...subjectToSubjIndex.values()].includes(subj.id)) {
          const newSubjIdx = subjectColList.length + 1;
          subjectColList.push({ col: nextCol, abbr: (subj.abbreviation || subj.name).toUpperCase() });
          subjectToSubjIndex.set(newSubjIdx, subj.id);

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
    }

const totalSheets = Math.ceil(inscriptions.length / MAX_STUDENTS_PER_SHEET);

    // Helper that fills a workbook opened from a file path with the subjects
    // and the page of students at studentOffset. Saves the filled workbook
    // back to the same file so the next stage can read it from disk.
    const fillWorkbookFromPath = async (
      sourcePath: string,
      studentOffset: number
    ): Promise<{ wb: ExcelJS.Workbook; wsName: string }> => {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(sourcePath);
      const ws = wb.getWorksheet(actualSheetName) || wb.worksheets[0];
      const wsName = ws!.name;
      const localNR = readTemplateNamedRanges(sourcePath);

      // Write subject abbreviations / full names
      for (let i = 1; i <= sortedAcademicSubjects.length; i++) {
        const ref = localNR.getCell(wsName, 'subj_' + i);
        const nameRef = localNR.getCell(wsName, 'subjname_' + i);
        const subj = sortedAcademicSubjects[i - 1];
        if (subj) {
          const abbrText = subj.abbreviation || subj.name;
          if (ref) ws!.getCell(ref.cell).value = abbrText;
          if (nameRef) ws!.getCell(nameRef.cell).value = subj.name;
        }
      }

      fillSheetByNamedRanges(
        ws!, wsName, localNR, settings, plantel, period,
        inscriptions, academicSubjects, groupedSubjectIds,
        subjectColList, subjectToSubjIndex,
        calculateFinalScore, subjectOrderMap, studentOffset
      );

      // Persist the filled workbook back to disk so the final assembly step
      // (which re-reads from the file) actually gets the data.
      await wb.xlsx.writeFile(sourcePath);
      return { wb, wsName };
    };

    // If we only have one page, use the workbook we already loaded in memory.
    if (totalSheets === 1) {
      fillSheetByNamedRanges(
        sheet!, actualSheetName, namedRanges, settings, plantel, period,
        inscriptions, academicSubjects, groupedSubjectIds,
        subjectColList, subjectToSubjIndex,
        calculateFinalScore, subjectOrderMap, 0
      );
    } else {
      // Multiple pages: BEFORE filling, copy the template to N temp files so
      // every page starts from the same identical template (logo, borders,
      // *** decorative text, etc.). Then fill each copy independently.
      const os = await import('os');
      const pathMod = await import('path');
      const fsMod = await import('fs/promises');
      const tmpRoot = await fsMod.mkdtemp(pathMod.join(os.tmpdir(), 'resumen-'));
      const pagePaths: string[] = [];
      for (let i = 0; i < totalSheets; i++) {
        const p = pathMod.join(tmpRoot, `page-${i + 1}.xlsx`);
        await fsMod.copyFile(templatePath, p);
        pagePaths.push(p);
      }

      try {
        // Fill each temp file with its own student range
        for (let i = 0; i < pagePaths.length; i++) {
          await fillWorkbookFromPath(pagePaths[i], i * MAX_STUDENTS_PER_SHEET);
        }

        // Build the final workbook by loading page 1 and then attaching the
        // other pages as additional worksheets. We rename them and copy
        // column widths / row heights so each page is fully identical visually.
        const finalWb = new ExcelJS.Workbook();
        await finalWb.xlsx.readFile(pagePaths[0]);

        // Drop any other sheets in the first page workbook (only the filled one)
        const keepName = finalWb.worksheets[0]!.name;
        finalWb.worksheets
          .filter(ws => ws.name !== keepName)
          .forEach(ws => finalWb.removeWorksheet(ws.id!));

        // Attach pages 2..N from their temp files
        for (let i = 1; i < pagePaths.length; i++) {
          const aux = new ExcelJS.Workbook();
          await aux.xlsx.readFile(pagePaths[i]);
          const auxSheet = aux.worksheets[0]!;
          // Drop the other aux sheets just in case
          aux.worksheets
            .filter(ws => ws.id !== auxSheet.id)
            .forEach(ws => aux.removeWorksheet(ws.id!));

          // Copy the aux sheet into finalWb as a new worksheet
          const newName = `${keepName} (${i + 1})`;
          const copied = finalWb.addWorksheet(newName, {
            properties: auxSheet.model.properties,
            views: auxSheet.model.views,
          });
          if (auxSheet.columns) {
            auxSheet.columns.forEach((col, idx) => {
              if (col && col.width != null) copied.getColumn(idx + 1).width = col.width;
            });
          }
          auxSheet.eachRow({ includeEmpty: true }, (row, rowNum) => {
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
              const newCell = copied.getRow(rowNum).getCell(colNumber);
              newCell.value = cell.value;
              if (cell.style) newCell.style = JSON.parse(JSON.stringify(cell.style));
              if (cell.numFmt) newCell.numFmt = cell.numFmt;
            });
            if (row.height != null) copied.getRow(rowNum).height = row.height;
          });
          if (auxSheet.model.merges) {
            // Use mergeCellsWithoutStyle (not mergeCells) to avoid re-ordering
            // cellXfs in the destination workbook, which would convert the
            // right border on column Z (the table edge) into a left border
            // on the copied sheet. The cell styles are already in place from
            // the per-cell style copy above.
            auxSheet.model.merges.forEach((merge: string) => (copied as any).mergeCellsWithoutStyle(merge));
          }

          // Copy images (e.g. the logo) from the aux workbook into the
          // copied sheet. ExcelJS stores media in the workbook; we have to
          // re-attach each image with the same anchor position.
          const auxImages = auxSheet.getImages();
          const auxMedia: any[] = (aux as any).model?.media || [];
          for (const img of auxImages) {
            const media = auxMedia[(img as any).imageId];
            if (!media || !media.buffer) continue;
            const newImageId = finalWb.addImage({
              buffer: media.buffer,
              extension: media.extension || 'png',
            });
            const makeAnchor = (a: any) => ({
              nativeCol: a.nativeCol,
              nativeColOff: a.nativeColOff,
              nativeRow: a.nativeRow,
              nativeRowOff: a.nativeRowOff,
            });
            (copied as any).addImage(newImageId, {
              tl: makeAnchor(img.range.tl),
              br: makeAnchor(img.range.br),
              editAs: (img as any).range.editAs,
            });
          }
        }

        const buffer = await finalWb.xlsx.writeBuffer();

        const fileName = 'resumen-rendimiento-' + grade.name.replace(/s+/g, '_') + '-' + section.name.replace(/s+/g, '_') + '.xlsx';

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="' + fileName + '"');
        res.send(buffer);
        return;
      } finally {
        // Clean up temp files
        await fsMod.rm(tmpRoot, { recursive: true, force: true });
      }
    }

    // Single-page path: keep the original workbook we already loaded.
    // Drop any extra sheets that may exist in the template besides the filled one.
    workbook.worksheets
      .filter(ws => ws.id !== sheet!.id)
      .forEach(ws => workbook.removeWorksheet(ws.id!));

    const buffer = await workbook.xlsx.writeBuffer();

    const fileName = 'resumen-rendimiento-' + grade.name.replace(/s+/g, '_') + '-' + section.name.replace(/s+/g, '_') + '.xlsx';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="' + fileName + '"');
    res.send(buffer);
  } catch (error: any) {
    console.error('[exportPerformanceSummary] Error:', error);
    res.status(500).json({ message: error.message || 'Error al exportar resumen de rendimiento' });
  }
};
