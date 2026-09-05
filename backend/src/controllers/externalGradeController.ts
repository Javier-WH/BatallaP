import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { Op, literal } from 'sequelize';
import { fieldExpr, quoteQualified } from '@/services/studentSortService';
import sequelize from '@/config/database';
import {
  Inscription,
  InscriptionSubject,
  Person,
  Plantel,
  SchoolPeriod,
  Subject,
  SubjectFinalGrade,
  Grade,
} from '@/models/index';
import {
  createExternalInscription,
  deleteExternalGrade,
  listExternalGradesForPerson,
  resolveOrCreatePlantel,
  upsertExternalGrade,
  registerExternalGradesBatch,
  ExternalGradeType,
  ExternalGradeStatus,
} from '@/services/externalGradeService';
import { parsePagination, buildPaginatedResponse } from '@/services/paginationService';

// Helper function to check if user has required role
const hasRole = (user: any, roles: string[]): boolean => {
  if (!user || !user.roles) return false;
  const userRoles = user.roles.map((r: any) => (typeof r === 'string' ? r : r.name));
  return roles.some((role) => userRoles.includes(role));
};

const ALLOWED_ROLES = ['Master', 'Administrador', 'Control de Estudios'];

const requireRole = (req: Request, res: Response): boolean => {
  const sessionUser = (req.session as any).user;
  if (!hasRole(sessionUser, ALLOWED_ROLES)) {
    res.status(403).json({ message: 'Solo Master, Administrador o Control de Estudios pueden gestionar notas externas' });
    return false;
  }
  return true;
};

/**
 * GET /api/external-grades/persons/:personId
 * Returns all external inscriptions + grades for a student.
 */
export const getExternalGradesForPerson = async (req: Request, res: Response) => {
  try {
    if (!requireRole(req, res)) return;
    const personId = parseInt(req.params.personId, 10);
    if (!personId) return res.status(400).json({ message: 'personId inválido' });

    const person = await Person.findByPk(personId);
    if (!person) return res.status(404).json({ message: 'Estudiante no encontrado' });

    const inscriptions = await listExternalGradesForPerson(personId);
    return res.json({ person, inscriptions });
  } catch (error: any) {
    console.error('[getExternalGradesForPerson] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al obtener notas externas' });
  }
};

/**
 * POST /api/external-grades/inscriptions
 * Body: { personId, periodLabel, periodName, startYear?, endYear?, gradeId, plantelId }
 * Creates (or reuses) an external inscription for a student.
 */
export const createInscription = async (req: Request, res: Response) => {
  try {
    if (!requireRole(req, res)) return;
    const t = await sequelize.transaction();
    try {
      const inscription = await createExternalInscription(req.body, t);
      await t.commit();
      return res.status(201).json(inscription);
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error: any) {
    console.error('[createExternalInscription] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al crear inscripción externa' });
  }
};

/**
 * POST /api/external-grades/planteles
 * Body: { code?, name, state?, dependency?, municipality?, parish? }
 * Resolve or create an external plantel.
 */
export const resolvePlantel = async (req: Request, res: Response) => {
  try {
    if (!requireRole(req, res)) return;
    const t = await sequelize.transaction();
    try {
      const plantel = await resolveOrCreatePlantel(req.body, t);
      await t.commit();
      return res.status(201).json(plantel);
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error: any) {
    console.error('[resolvePlantel] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al registrar plantel externo' });
  }
};

/**
 * POST /api/external-grades/grades
 * Body: { inscriptionId, subjectId, finalScore, status, plantelId, issuedAt, gradeType, observations? }
 * Upsert an external final grade.
 */
export const upsertGrade = async (req: Request, res: Response) => {
  try {
    if (!requireRole(req, res)) return;
    const {
      inscriptionId,
      subjectId,
      finalScore,
      status,
      plantelId,
      issuedAt,
      gradeType,
      observations,
    } = req.body as {
      inscriptionId: number;
      subjectId: number;
      finalScore: number;
      status: ExternalGradeStatus;
      plantelId: number;
      issuedAt: string;
      gradeType: ExternalGradeType;
      observations?: string | null;
    };

    if (!inscriptionId || !subjectId || finalScore == null || !plantelId || !issuedAt || !gradeType) {
      return res.status(400).json({ message: 'Faltan campos obligatorios' });
    }
    if (!['transferencia', 'equivalencia'].includes(gradeType)) {
      return res.status(400).json({ message: 'gradeType debe ser transferencia o equivalencia' });
    }
    if (!['aprobada', 'reprobada'].includes(status)) {
      return res.status(400).json({ message: 'status debe ser aprobada o reprobada' });
    }

    const t = await sequelize.transaction();
    try {
      const grade = await upsertExternalGrade(
        {
          inscriptionId,
          subjectId,
          finalScore: Number(finalScore),
          status,
          plantelId,
          issuedAt: new Date(issuedAt),
          gradeType,
          observations: observations ?? null,
          editedBy: (req.session as any)?.user?.id,
        },
        t
      );
      await t.commit();
      return res.status(201).json(grade);
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error: any) {
    console.error('[upsertExternalGrade] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al guardar nota externa' });
  }
};

/**
 * PUT /api/external-grades/grades/:id
 * Update an existing external final grade.
 */
export const updateGrade = async (req: Request, res: Response) => {
  try {
    if (!requireRole(req, res)) return;
    const id = parseInt(req.params.id, 10);
    const { finalScore, status, plantelId, issuedAt, gradeType } = req.body as {
      finalScore?: number;
      status?: ExternalGradeStatus;
      plantelId?: number;
      issuedAt?: string;
      gradeType?: ExternalGradeType;
    };

    const existing = await SubjectFinalGrade.findByPk(id);
    if (!existing) return res.status(404).json({ message: 'Nota no encontrada' });
    if (existing.gradeType !== 'transferencia' && existing.gradeType !== 'equivalencia') {
      return res.status(400).json({ message: 'Solo se pueden editar notas externas' });
    }

    const patch: any = {};
    if (finalScore != null) patch.finalScore = Number(finalScore);
    if (status) {
      if (!['aprobada', 'reprobada'].includes(status)) {
        return res.status(400).json({ message: 'status debe ser aprobada o reprobada' });
      }
      patch.status = status;
    }
    if (plantelId) patch.plantelId = plantelId;
    if (issuedAt) patch.calculatedAt = new Date(issuedAt);
    if (gradeType) {
      if (!['transferencia', 'equivalencia'].includes(gradeType)) {
        return res.status(400).json({ message: 'gradeType debe ser transferencia o equivalencia' });
      }
      patch.gradeType = gradeType;
    }

    await existing.update(patch);
    return res.json(existing);
  } catch (error: any) {
    console.error('[updateExternalGrade] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al actualizar nota externa' });
  }
};

/**
 * DELETE /api/external-grades/grades/:id
 * Delete an external final grade.
 */
export const removeGrade = async (req: Request, res: Response) => {
  try {
    if (!requireRole(req, res)) return;
    const id = parseInt(req.params.id, 10);
    const t = await sequelize.transaction();
    try {
      await deleteExternalGrade(id, t);
      await t.commit();
      return res.status(204).send();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (error: any) {
    console.error('[removeExternalGrade] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al eliminar nota externa' });
  }
};

/**
 * GET /api/external-grades/subjects
 * Returns the subject catalog (for selectors in the UI).
 */
export const listSubjects = async (_req: Request, res: Response) => {
  try {
    const subjects = await Subject.findAll({ order: [['name', 'ASC']] });
    return res.json(subjects);
  } catch (error: any) {
    console.error('[listSubjects] Error:', error);
    return res.status(500).json({ message: 'Error al listar materias' });
  }
};

/**
 * GET /api/external-grades/grades
 * Returns external grades with optional filters (personId, plantelId).
 * Supports opt-in pagination via page/pageSize query params.
 */
export const listGrades = async (req: Request, res: Response) => {
  try {
    if (!requireRole(req, res)) return;
    const { personId, plantelId } = req.query;

    const where: any = { gradeType: ['transferencia', 'equivalencia'] };
    if (plantelId) where.plantelId = Number(plantelId);

    const pagination = parsePagination(req.query as Record<string, unknown>);

    // Shared include tree for both ID query and hydration.
    const inscriptionWhere = personId ? { personId: Number(personId) } : undefined;
    const baseInclude: any[] = [
      {
        model: InscriptionSubject,
        as: 'inscriptionSubject',
        include: [
          {
            model: Inscription,
            as: 'inscription',
            where: inscriptionWhere,
            required: !!personId, // INNER JOIN when filtering by person
            include: [
              { model: Person, as: 'student' },
              { model: SchoolPeriod, as: 'period' },
              { model: Grade, as: 'grade' },
            ],
          },
          { model: Subject, as: 'subject' },
        ],
      },
      { model: Plantel, as: 'plantel' },
    ];

    if (!pagination.isPaginated) {
      // Legacy: return flat array, no limit.
      const fullGrades = await SubjectFinalGrade.findAll({
        where,
        include: baseInclude,
        order: [['calculatedAt', 'DESC']],
      });
      return res.json(fullGrades);
    }

    // Paginated: IDs first, then hydrate.
    const idRows = await SubjectFinalGrade.findAll({
      where,
      include: baseInclude,
      attributes: ['id'],
      order: [['calculatedAt', 'DESC']],
      limit: pagination.limit,
      offset: pagination.offset,
      subQuery: false,
      raw: true,
    });
    const ids = idRows.map((r: any) => r.id);

    const total = await SubjectFinalGrade.count({
      where,
      include: baseInclude,
      distinct: true,
      col: 'id',
    }) as unknown as number;

    let fullGrades: SubjectFinalGrade[] = [];
    if (ids.length > 0) {
      fullGrades = await SubjectFinalGrade.findAll({
        where: { id: { [Op.in]: ids } },
        include: baseInclude,
        order: [literal(fieldExpr(quoteQualified('SubjectFinalGrade', 'id'), ids.map(String)))],
      });
    }

    return res.json(buildPaginatedResponse(fullGrades, total, pagination));
  } catch (error: any) {
    console.error('[listExternalGrades] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al listar notas externas' });
  }
};

/**
 * POST /api/external-grades/bulk
 * Body: Array of entries (see registerExternalGradesBatch signature).
 * Processes a batch of external grade registrations in a single transaction.
 */
export const bulkRegister = async (req: Request, res: Response) => {
  try {
    if (!requireRole(req, res)) return;
    const entries = req.body;
    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ message: 'Se requiere un arreglo de entradas' });
    }
    const result = await registerExternalGradesBatch(entries);
    return res.status(201).json(result);
  } catch (error: any) {
    console.error('[bulkRegister] Error:', error);
    return res.status(500).json({ message: error.message || 'Error en carga masiva' });
  }
};

/**
 * GET /api/external-grades/bulk/template
 * Downloads an Excel template for bulk external grade import.
 */
export const downloadBulkTemplate = async (req: Request, res: Response) => {
  try {
    if (!requireRole(req, res)) return;

    const subjects = await Subject.findAll({ order: [['name', 'ASC']] });
    const grades = await Grade.findAll({ order: [['order', 'ASC'], ['name', 'ASC']] });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Notas Externas');

    sheet.columns = [
      { header: 'Cédula Estudiante', key: 'document', width: 20 },
      { header: 'Código DEA Plantel', key: 'plantelCode', width: 18 },
      { header: 'Nombre Plantel', key: 'plantelName', width: 35 },
      { header: 'Estado Plantel', key: 'plantelState', width: 18 },
      { header: 'Período', key: 'periodLabel', width: 12 },
      { header: 'Nombre Período', key: 'periodName', width: 30 },
      { header: 'Grado (nombre)', key: 'gradeName', width: 20 },
      { header: 'Materia (nombre)', key: 'subjectName', width: 30 },
      { header: 'Nota (0-20)', key: 'finalScore', width: 12 },
      { header: 'Estado (aprobada/reprobada)', key: 'status', width: 22 },
      { header: 'Tipo (transferencia/equivalencia)', key: 'gradeType', width: 28 },
      { header: 'Fecha Documento (YYYY-MM-DD)', key: 'issuedAt', width: 24 },
    ];

    // Style header row
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add a sample row
    sheet.addRow({
      document: '12345678',
      plantelCode: '090123',
      plantelName: 'U.E. Colegio Example',
      plantelState: 'Aragua',
      periodLabel: '2024-2025',
      periodName: '2024-2025 - Colegio Example',
      gradeName: '1er Año',
      subjectName: 'Matemática',
      finalScore: 14,
      status: 'aprobada',
      gradeType: 'transferencia',
      issuedAt: '2025-07-15',
    });

    // Reference sheet with available subjects and grades
    const refSheet = workbook.addWorksheet('Referencias');
    refSheet.columns = [
      { header: 'Materias disponibles', key: 'subject', width: 40 },
      { header: 'Grados disponibles', key: 'grade', width: 30 },
    ];
    refSheet.getRow(1).font = { bold: true };

    const maxRows = Math.max(subjects.length, grades.length);
    for (let i = 0; i < maxRows; i++) {
      refSheet.addRow({
        subject: subjects[i]?.name ?? '',
        grade: grades[i]?.name ?? '',
      });
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_notas_externas.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error: any) {
    console.error('[downloadBulkTemplate] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al generar plantilla' });
  }
};

/**
 * POST /api/external-grades/bulk/process
 * Processes an uploaded Excel file with external grades.
 * Expects multipart/form-data with field "file".
 */
export const bulkProcessExcel = async (req: Request, res: Response) => {
  try {
    if (!requireRole(req, res)) return;
    if (!req.file) {
      return res.status(400).json({ message: 'No se cargó ningún archivo' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const sheet = workbook.getWorksheet('Notas Externas') || workbook.worksheets[0];
    if (!sheet) {
      return res.status(400).json({ message: 'La hoja "Notas Externas" no existe en el archivo' });
    }

    // Preload catalogs for name -> id resolution
    const subjects = await Subject.findAll();
    const subjectByName = new Map(subjects.map((s) => [s.name.toLowerCase().trim(), s]));
    const grades = await Grade.findAll();
    const gradeByName = new Map(grades.map((g) => [g.name.toLowerCase().trim(), g]));
    const persons = await Person.findAll();
    const personByDocument = new Map(persons.map((p) => [String(p.document).trim(), p]));

    const entries: Array<any> = [];
    const errors: Array<{ row: number; message: string }> = [];

    // Skip header row
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const values = row.values as any[];
      // values[0] is undefined in exceljs; columns start at 1
      const document = String(values[1] ?? '').trim();
      const plantelCode = String(values[2] ?? '').trim();
      const plantelName = String(values[3] ?? '').trim();
      const plantelState = String(values[4] ?? '').trim();
      const periodLabel = String(values[5] ?? '').trim();
      const periodName = String(values[6] ?? '').trim();
      const gradeName = String(values[7] ?? '').trim();
      const subjectName = String(values[8] ?? '').trim();
      const finalScoreRaw = values[9];
      const status = String(values[10] ?? '').trim().toLowerCase();
      const gradeType = String(values[11] ?? '').trim().toLowerCase();
      const issuedAt = String(values[12] ?? '').trim();

      if (!document && !subjectName) return; // skip empty rows

      // Validate
      const person = personByDocument.get(document);
      if (!person) {
        errors.push({ row: rowNumber, message: `Estudiante con cédula "${document}" no encontrado` });
        return;
      }
      const subject = subjectByName.get(subjectName.toLowerCase());
      if (!subject) {
        errors.push({ row: rowNumber, message: `Materia "${subjectName}" no encontrada` });
        return;
      }
      const grade = gradeByName.get(gradeName.toLowerCase());
      if (!grade) {
        errors.push({ row: rowNumber, message: `Grado "${gradeName}" no encontrado` });
        return;
      }
      const finalScore = Number(finalScoreRaw);
      if (isNaN(finalScore)) {
        errors.push({ row: rowNumber, message: `Nota inválida: ${finalScoreRaw}` });
        return;
      }
      if (!['aprobada', 'reprobada'].includes(status)) {
        errors.push({ row: rowNumber, message: `Estado inválido: ${status}` });
        return;
      }
      if (!['transferencia', 'equivalencia'].includes(gradeType)) {
        errors.push({ row: rowNumber, message: `Tipo inválido: ${gradeType}` });
        return;
      }
      const issuedDate = new Date(issuedAt);
      if (isNaN(issuedDate.getTime())) {
        errors.push({ row: rowNumber, message: `Fecha inválida: ${issuedAt}` });
        return;
      }

      // Group by person + period + plantel
      const groupKey = `${person.id}|${periodLabel}|${plantelCode || plantelName}`;
      let entry = entries.find((e) => e._key === groupKey);
      if (!entry) {
        entry = {
          _key: groupKey,
          personId: person.id,
          periodLabel,
          periodName: periodName || periodLabel,
          gradeId: grade.id,
          plantel: {
            code: plantelCode || undefined,
            name: plantelName,
            state: plantelState || undefined,
          },
          grades: [],
        };
        entries.push(entry);
      }
      entry.grades.push({
        subjectId: subject.id,
        finalScore,
        status: status as ExternalGradeStatus,
        issuedAt: issuedDate,
        gradeType: gradeType as ExternalGradeType,
      });
    });

    if (errors.length > 0) {
      return res.status(400).json({
        message: 'Se encontraron errores en el archivo',
        errors: errors.slice(0, 50),
        totalErrors: errors.length,
      });
    }

    // Strip internal _key before sending to service
    const cleanEntries = entries.map(({ _key, ...rest }: any) => rest);
    const result = await registerExternalGradesBatch(cleanEntries);
    return res.status(201).json(result);
  } catch (error: any) {
    console.error('[bulkProcessExcel] Error:', error);
    return res.status(500).json({ message: error.message || 'Error al procesar archivo' });
  } finally {
    // Clean up uploaded file
    if (req.file) {
      try { await import('fs/promises').then((fs) => fs.unlink(req.file!.path)); } catch {}
    }
  }
};
