import { Request, Response } from 'express';
import { Op } from 'sequelize';
import ExcelJS from 'exceljs';
import {
  Person,
  TeacherAssignment,
  PeriodGradeSubject,
  Subject,
  SubjectGroup,
  Grade,
  Section,
  PeriodGrade,
  SchoolPeriod,
  EvaluationPlan,
  Qualification,
  Inscription,
  InscriptionSubject,
  Term,
  CouncilPoint,
  PendingSubject,
  SubjectFinalGrade,
  GradeEditPermission,
  GradeEditAudit,
  User,
  Plantel
} from '@/models/index';
import {
  getSubjectOrderMapByGradeAndPeriod,
  sortSubjectsWithPendingAtEnd,
  sortSubjectsByOrder,
} from '@/services/subjectOrderService';

export const getMyAssignments = async (req: Request, res: Response) => {
  try {
    const user = (req.session as any).user;
    if (!user) return res.status(401).json({ message: 'No autorizado' });

    const person = await Person.findOne({ where: { userId: user.id } });
    if (!person) return res.status(404).json({ message: 'Perfil de profesor no encontrado' });

    const assignments = await TeacherAssignment.findAll({
      where: { teacherId: person.id },
      include: [
        {
          model: PeriodGradeSubject,
          as: 'periodGradeSubject',
          required: true, // Force inner join
          include: [
            { model: Subject, as: 'subject' },
            {
              model: PeriodGrade,
              as: 'periodGrade',
              required: true, // Force inner join
              include: [
                { model: Grade, as: 'grade' },
                {
                  model: SchoolPeriod,
                  as: 'schoolPeriod',
                  required: true, // Force inner join
                  where: { isActive: true } // Only active period
                }
              ]
            }
          ]
        },
        { model: Section, as: 'section' },
        { model: Person, as: 'teacher' }
      ],
      order: [['id', 'DESC']]
    });

    res.json(assignments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener asignaciones' });
  }
};

export const getEvaluationPlan = async (req: Request, res: Response) => {
  try {
    const { periodGradeSubjectId } = req.params;
    const { term, sectionId } = req.query;

    const where: any = { periodGradeSubjectId };
    if (term) where.termId = term; // Changed from where.term to where.termId
    if (sectionId) where.sectionId = sectionId;

    const plan = await EvaluationPlan.findAll({
      where,
      order: [['date', 'ASC']]
    });
    res.json(plan);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener plan de evaluación' });
  }
};

export const createEvaluationItem = async (req: Request, res: Response) => {
  try {
    // Prevent creating plan items on blocked terms
    const { termId, periodGradeSubjectId, sectionId, identificador } = req.body;
    if (termId) {
      const term = await Term.findByPk(termId);
      if (!term) {
        return res.status(404).json({ message: 'Lapso no encontrado' });
      }
      if (term.isBlocked) {
        return res.status(403).json({ message: 'Lapso bloqueado; no se pueden modificar el plan de evaluación' });
      }
    }

    // Check for duplicate identificador within same subject+section+term
    if (identificador) {
      const existing = await EvaluationPlan.findOne({
        where: { periodGradeSubjectId, sectionId, termId, identificador }
      });
      if (existing) {
        return res.status(400).json({ message: `El identificador "${identificador}" ya existe en este plan de evaluación` });
      }
    }

    const item = await EvaluationPlan.create(req.body);
    res.json(item);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateEvaluationItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await EvaluationPlan.findByPk(id);
    if (!item) return res.status(404).json({ message: 'Item no encontrado' });

    const targetTermId = req.body.termId ?? item.termId;
    const term = await Term.findByPk(targetTermId);
    if (!term) {
      return res.status(404).json({ message: 'Lapso no encontrado' });
    }
    if (term.isBlocked) {
      return res.status(403).json({ message: 'Lapso bloqueado; no se pueden modificar el plan de evaluación' });
    }

    // Check for duplicate identificador within same subject+section+term
    const newIdentificador = req.body.identificador ?? item.identificador;
    const pgsId = req.body.periodGradeSubjectId ?? item.periodGradeSubjectId;
    const secId = req.body.sectionId ?? item.sectionId;
    const tId = req.body.termId ?? item.termId;
    if (newIdentificador) {
      const existing = await EvaluationPlan.findOne({
        where: {
          periodGradeSubjectId: pgsId,
          sectionId: secId,
          termId: tId,
          identificador: newIdentificador,
          id: { [Op.ne]: Number(id) }
        }
      });
      if (existing) {
        return res.status(400).json({ message: `El identificador "${newIdentificador}" ya existe en este plan de evaluación` });
      }
    }

    await item.update(req.body);
    res.json(item);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteEvaluationItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await EvaluationPlan.findByPk(id);
    if (!item) {
      return res.status(404).json({ message: 'Item no encontrado' });
    }

    const term = await Term.findByPk(item.termId);
    if (!term) {
      return res.status(404).json({ message: 'Lapso no encontrado' });
    }
    if (term.isBlocked) {
      return res.status(403).json({ message: 'Lapso bloqueado; no se pueden modificar el plan de evaluación' });
    }

    await EvaluationPlan.destroy({ where: { id } });
    res.json({ message: 'Item eliminado' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar item' });
  }
};

export const getStudentsForAssignment = async (req: Request, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const assignment = await TeacherAssignment.findByPk(assignmentId, {
      include: [
        {
          model: PeriodGradeSubject,
          as: 'periodGradeSubject'
        }
      ]
    });

    if (!assignment) return res.status(404).json({ message: 'Asignación no encontrada' });

    const { periodGradeSubject, sectionId } = assignment as any;

    // Get period and grade from the periodGrade record
    const pg = await PeriodGrade.findByPk(periodGradeSubject.periodGradeId);
    if (!pg) return res.status(404).json({ message: 'Estructura no encontrada' });

    const inscriptions = await Inscription.findAll({
      where: {
        schoolPeriodId: pg.schoolPeriodId,
        sectionId,
        [Op.or]: [
          { gradeId: pg.gradeId },
          { escolaridad: 'materia_pendiente' }
        ]
      },
      include: [
        { model: Person, as: 'student' },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          where: { subjectId: periodGradeSubject.subjectId },
          required: true, // Changed to true to filter only those enrolled in the subject
          include: [
            {
              model: Qualification,
              as: 'qualifications',
              include: [{ model: EvaluationPlan, as: 'evaluationPlan' }]
            }
          ]
        }
      ]
    });

    res.json(inscriptions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener estudiantes' });
  }
};

export const getQualifications = async (req: Request, res: Response) => {
  try {
    const { inscriptionSubjectId } = req.params;
    const qualifications = await Qualification.findAll({
      where: { inscriptionSubjectId }
    });
    res.json(qualifications);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener calificaciones' });
  }
};

export const saveQualification = async (req: Request, res: Response) => {
  try {
    const { evaluationPlanId, inscriptionSubjectId, score, observations, inscriptionId } = req.body;

    let finalInscriptionSubjectId = inscriptionSubjectId;

    // Validate term state: if the associated term is blocked, forbid changes
    const evalPlan = await EvaluationPlan.findByPk(evaluationPlanId);
    if (!evalPlan) {
      return res.status(404).json({ message: 'Plan de evaluación no encontrado' });
    }
    const term = await Term.findByPk(evalPlan.termId);
    if (!term) {
      return res.status(404).json({ message: 'Lapso no encontrado' });
    }
    if (term.isBlocked) {
      return res.status(403).json({ message: 'Lapso bloqueado; no se pueden modificar calificaciones' });
    }

    // Robust handling: If inscriptionSubjectId is missing but we have inscriptionId, we can resolve it
    if (!finalInscriptionSubjectId && inscriptionId) {
      const ep = await EvaluationPlan.findByPk(evaluationPlanId, {
        include: [{ model: PeriodGradeSubject, as: 'periodGradeSubject' }]
      });

      const evalPlanWithSubject = ep as any;
      if (evalPlanWithSubject && evalPlanWithSubject.periodGradeSubject) {
        const [insSub] = await InscriptionSubject.findOrCreate({
          where: {
            inscriptionId,
            subjectId: evalPlanWithSubject.periodGradeSubject.subjectId
          },
          defaults: {
            inscriptionId,
            subjectId: evalPlanWithSubject.periodGradeSubject.subjectId
          }
        });
        finalInscriptionSubjectId = insSub.id;
      }
    }

    if (!finalInscriptionSubjectId) {
      return res.status(400).json({ message: 'No se pudo determinar el enlace del estudiante con la materia' });
    }

    // Check if exists to update, else create
    const [qualification, created] = await Qualification.findOrCreate({
      where: { evaluationPlanId, inscriptionSubjectId: finalInscriptionSubjectId },
      defaults: { evaluationPlanId, inscriptionSubjectId: finalInscriptionSubjectId, score, observations }
    });

    if (!created) {
      await qualification.update({ score, observations });
    }

    res.json(qualification);
  } catch (error) {
    console.error('Error in saveQualification:', error);
    res.status(500).json({ message: 'Error al guardar calificación' });
  }
};

export const getStudentFullAcademicRecord = async (req: Request, res: Response) => {
  try {
    const { personId } = req.params;

    const records = await Inscription.findAll({
      where: { personId },
      include: [
        { model: SchoolPeriod, as: 'period' },
        { model: Grade, as: 'grade' },
        { model: Section, as: 'section' },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          include: [
            {
              model: Subject,
              as: 'subject',
              include: [{ model: SubjectGroup, as: 'subjectGroup', attributes: ['id', 'name'] }]
            },
            {
              model: Qualification,
              as: 'qualifications',
              include: [{ model: EvaluationPlan, as: 'evaluationPlan' }]
            },
            {
              model: CouncilPoint,
              as: 'councilPoints'
            }
          ]
        },
        {
          model: PendingSubject,
          as: 'pendingSubjects',
          required: false
        }
      ],
      order: [
        [{ model: SchoolPeriod, as: 'period' }, 'id', 'DESC'],
      ]
    });

    // Log to verify usesLiteralGrades is being returned
    if (records.length > 0) {
      const firstRecord = records[0];
      const firstSubject = (firstRecord as any).inscriptionSubjects?.[0]?.subject;
      console.log('[getStudentFullAcademicRecord] First subject data:', JSON.stringify(firstSubject, null, 2));
    }

    // Apply canonical subject order per inscription (PeriodGradeSubject.order)
    // with pendings appended at the end. See subjectOrderService for rules.
    const recordsWithPendingFlag = await Promise.all(
      records.map(async (record) => {
        const recordAny = record as any;
        const pendingSubjectIds = new Set(
          recordAny.pendingSubjects?.map((ps: any) => ps.subjectId) ?? []
        );
        const recordJson = record.toJSON() as any;

        if (recordJson.inscriptionSubjects) {
          const withFlags = recordJson.inscriptionSubjects.map((is: any) => ({
            ...is,
            isPending: pendingSubjectIds.has(is.subjectId),
          }));

          const orderMap = await getSubjectOrderMapByGradeAndPeriod(
            recordJson.gradeId,
            recordJson.schoolPeriodId
          );

          recordJson.inscriptionSubjects = sortSubjectsWithPendingAtEnd(
            withFlags,
            (is: any) => is.subjectId,
            (is: any) => is.subject?.name,
            (is: any) => !!is.isPending,
            orderMap
          );
        }

        return recordJson;
      })
    );

    res.json(recordsWithPendingFlag);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener historial' });
  }
};

export const updateFinalGrade = async (req: Request, res: Response) => {
  console.log('[updateFinalGrade] FUNCTION CALLED');
  try {
    const sessionUser = (req.session as any).user;
    console.log('[updateFinalGrade] Session user:', sessionUser?.id, sessionUser?.roles);
    if (!sessionUser) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    // Check if user has Control de Estudios role
    const userRoles = sessionUser.roles || [];
    console.log('[updateFinalGrade] User roles:', userRoles);
    if (!userRoles.includes('Control de Estudios')) {
      return res.status(403).json({ message: 'Solo Control de Estudios puede modificar notas finales' });
    }

    const { id } = req.params;
    const { finalScore, status, reason, permissionId, actCode, plantelId, gradeType } = req.body;
    console.log('[updateFinalGrade] Request params:', { id, finalScore, status, reason, permissionId, actCode, plantelId, gradeType });

    let normalizedPlantelId: number | null | undefined = undefined;
    if (plantelId !== undefined) {
      if (plantelId === null) {
        normalizedPlantelId = null;
      } else {
        const plantel = await Plantel.findByPk(Number(plantelId));
        if (!plantel) {
          return res.status(400).json({ message: 'Plantel no encontrado' });
        }
        normalizedPlantelId = plantel.id;
      }
    }

    if (!reason) {
      return res.status(400).json({ message: 'La razón de la modificación es obligatoria' });
    }

    if (!permissionId) {
      return res.status(400).json({ message: 'Se requiere el ID del permiso que autoriza la modificación' });
    }

    console.log('[updateFinalGrade] Validations passed');

    // If id is null or 'new-', create a new record instead of updating
    if (!id || id.toString().startsWith('new-')) {
      console.log('[updateFinalGrade] Creating new grade (id is null or starts with new-)');
      // Extract inscriptionSubjectId from the id
      const inscriptionSubjectId = id?.toString().replace('new-', '') || req.body.inscriptionSubjectId;

      if (!inscriptionSubjectId) {
        return res.status(400).json({ message: 'Se requiere inscriptionSubjectId para crear nota final' });
      }

      // Check if SubjectFinalGrade already exists for this inscriptionSubject
      const existingGrade = await SubjectFinalGrade.findOne({
        where: { inscriptionSubjectId: Number(inscriptionSubjectId) }
      });

      if (existingGrade) {
        console.log('[updateFinalGrade] Found existing grade, updating it');
        // Update existing grade instead of creating new one
        // Store previous values for audit
        const previousScore = existingGrade.finalScore;
        const previousStatus = existingGrade.status;

        console.log(`[updateFinalGrade] Updating existing grade ID: ${existingGrade.id}, Previous score: ${previousScore}, New score: ${finalScore}`);

        // Verify permission
        const permission = await GradeEditPermission.findOne({
          where: { id: permissionId, isActive: true }
        });

        if (!permission) {
          return res.status(404).json({ message: 'Permiso no encontrado o inactivo' });
        }

        if (permission.grantedTo !== sessionUser.id) {
          return res.status(403).json({ message: 'El permiso no pertenece al usuario actual' });
        }

        const previousPlantelId = existingGrade.plantelId;

        // Update the final grade
        await existingGrade.update({
          finalScore: finalScore !== undefined ? finalScore : existingGrade.finalScore,
          status: status || existingGrade.status,
          ...(normalizedPlantelId !== undefined ? { plantelId: normalizedPlantelId } : {})
        });

        console.log(`[updateFinalGrade] Grade updated successfully, new value: ${existingGrade.finalScore}`);

        // Create audit record
        await GradeEditAudit.create({
          subjectFinalGradeId: existingGrade.id,
          permissionId: permission.id,
          editedBy: sessionUser.id,
          previousScore,
          newScore: finalScore,
          previousStatus,
          newStatus: existingGrade.status,
          reason,
          editedAt: new Date(),
          actCode,
          previousPlantelId,
          newPlantelId: existingGrade.plantelId
        });

        return res.json({ message: 'Nota final actualizada correctamente', finalGrade: existingGrade });
      }

      // Get inscription subject to verify period
      const inscriptionSubject = await InscriptionSubject.findByPk(Number(inscriptionSubjectId), {
        include: [
          {
            model: Inscription,
            as: 'inscription',
            include: [
              {
                model: SchoolPeriod,
                as: 'period'
              }
            ]
          }
        ]
      });

      if (!inscriptionSubject) {
        return res.status(404).json({ message: 'Inscripción de materia no encontrada' });
      }

      const schoolPeriod = (inscriptionSubject as any).inscription?.period;
      if (!schoolPeriod) {
        return res.status(400).json({ message: 'No se pudo determinar el período escolar' });
      }

      if (schoolPeriod.isActive) {
        return res.status(403).json({ message: 'No se pueden modificar notas de períodos activos' });
      }

      // Verify permission
      const permission = await GradeEditPermission.findOne({
        where: { id: permissionId, isActive: true }
      });

      if (!permission) {
        return res.status(404).json({ message: 'Permiso no encontrado o inactivo' });
      }

      if (permission.grantedTo !== sessionUser.id) {
        return res.status(403).json({ message: 'El permiso no pertenece al usuario actual' });
      }

      if (permission.schoolPeriodId && permission.schoolPeriodId !== schoolPeriod.id) {
        return res.status(403).json({ message: 'El permiso no cubre este período escolar' });
      }

      // Create new final grade
      const newFinalGrade = await SubjectFinalGrade.create({
        inscriptionSubjectId: Number(inscriptionSubjectId),
        finalScore,
        status: status || (finalScore >= 10 ? 'aprobada' : 'reprobada'),
        plantelId: normalizedPlantelId ?? null
      });

      // Create audit record
      await GradeEditAudit.create({
        subjectFinalGradeId: newFinalGrade.id,
        permissionId: permission.id,
        editedBy: sessionUser.id,
        previousScore: null,
        newScore: finalScore,
        previousStatus: null,
        newStatus: newFinalGrade.status,
        reason,
        editedAt: new Date(),
        actCode,
        previousPlantelId: null,
        newPlantelId: newFinalGrade.plantelId
      });

      return res.json({ message: 'Nota final creada correctamente', finalGrade: newFinalGrade });
    }

    console.log('[updateFinalGrade] Updating by ID (not null/new)');

    // Get the final grade record
    console.log('[updateFinalGrade] Fetching grade with ID:', Number(id));
    const finalGrade = await SubjectFinalGrade.findByPk(Number(id), {
      include: [
        {
          model: InscriptionSubject,
          as: 'inscriptionSubject',
          include: [
            {
              model: Inscription,
              as: 'inscription',
              include: [
                {
                  model: SchoolPeriod,
                  as: 'period'
                }
              ]
            }
          ]
        }
      ]
    });
    console.log('[updateFinalGrade] Grade fetched:', finalGrade ? finalGrade.id : 'null');

    if (!finalGrade) {
      console.log('[updateFinalGrade] Grade not found');
      return res.status(404).json({ message: 'Nota final no encontrada' });
    }

    // Verify that the school period is inactive
    const schoolPeriod = (finalGrade as any).inscriptionSubject?.inscription?.period;
    console.log('[updateFinalGrade] School period:', schoolPeriod?.id, schoolPeriod?.name, 'isActive:', schoolPeriod?.isActive);
    if (!schoolPeriod) {
      console.log('[updateFinalGrade] School period not found');
      return res.status(400).json({ message: 'No se pudo determinar el período escolar' });
    }

    if (schoolPeriod.isActive) {
      console.log('[updateFinalGrade] Period is active, cannot modify');
      return res.status(403).json({ message: 'No se pueden modificar notas de períodos activos' });
    }

    // Verify the permission
    console.log('[updateFinalGrade] Fetching permission ID:', permissionId);
    const permission = await GradeEditPermission.findOne({
      where: { id: permissionId, isActive: true }
    });
    console.log('[updateFinalGrade] Permission fetched:', permission ? permission.id : 'null');

    if (!permission) {
      return res.status(404).json({ message: 'Permiso no encontrado o inactivo' });
    }

    // Verify permission belongs to the current user
    console.log('[updateFinalGrade] Checking permission ownership: permission.grantedTo:', permission.grantedTo, 'sessionUser.id:', sessionUser.id);
    if (permission.grantedTo !== sessionUser.id) {
      return res.status(403).json({ message: 'El permiso no pertenece al usuario actual' });
    }

    // Verify permission covers this school period (either global or specific)
    console.log('[updateFinalGrade] Checking period coverage: permission.schoolPeriodId:', permission.schoolPeriodId, 'schoolPeriod.id:', schoolPeriod.id);
    if (permission.schoolPeriodId && permission.schoolPeriodId !== schoolPeriod.id) {
      return res.status(403).json({ message: 'El permiso no cubre este período escolar' });
    }

    // Store previous values for audit
    const previousScore = finalGrade.finalScore;
    const previousStatus = finalGrade.status;
    const previousPlantelId = finalGrade.plantelId;

    console.log('[updateFinalGrade] Updating grade, previous score:', previousScore, 'new score:', finalScore);

    // Update the final grade
    await finalGrade.update({
      finalScore: finalScore !== undefined ? finalScore : finalGrade.finalScore,
      status: status || finalGrade.status,
      ...(normalizedPlantelId !== undefined ? { plantelId: normalizedPlantelId } : {}),
      ...(gradeType !== undefined ? { gradeType } : {})
    });

    console.log('[updateFinalGrade] Grade updated successfully');

    // Create audit record
    console.log('[updateFinalGrade] Creating audit record');
    await GradeEditAudit.create({
      subjectFinalGradeId: finalGrade.id,
      permissionId: permission.id,
      editedBy: sessionUser.id,
      previousScore,
      newScore: finalGrade.finalScore,
      previousStatus,
      newStatus: finalGrade.status,
      reason,
      editedAt: new Date(),
      actCode,
      previousPlantelId,
      newPlantelId: finalGrade.plantelId
    });

    console.log('[updateFinalGrade] Audit record created, sending response');
    res.json({ message: 'Nota final actualizada correctamente', finalGrade });
  } catch (error: any) {
    console.error('[updateFinalGrade] Error:', error);
    res.status(500).json({ message: 'Error al actualizar nota final', error: error.message });
  }
};

// Helper function to check if user has required role
const hasRole = (user: any, roles: string[]): boolean => {
  if (!user || !user.roles) return false;
  const userRoles = user.roles.map((r: any) => typeof r === 'string' ? r : r.name);
  return roles.some(role => userRoles.includes(role));
};

export const getFinalGradesByPeriod = async (req: Request, res: Response) => {
  try {
    const sessionUser = (req.session as any).user;
    if (!sessionUser) {
      return res.status(401).json({ message: 'No autorizado' });
    }

    // Only Control de Estudios can view final grades
    if (!hasRole(sessionUser, ['Control de Estudios'])) {
      return res.status(403).json({ message: 'Solo Control de Estudios puede ver las notas finales' });
    }

    const { schoolPeriodId } = req.query;

    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'schoolPeriodId es requerido' });
    }

    // Verify the school period exists
    const period = await SchoolPeriod.findByPk(Number(schoolPeriodId));
    if (!period) {
      return res.status(404).json({ message: 'Período escolar no encontrado' });
    }

    // Allow both active and inactive periods for viewing final grades
    // The permission check will determine if editing is allowed

    // Check if user has permission for this period
    const globalPermission = await GradeEditPermission.findOne({
      where: {
        grantedTo: sessionUser.id,
        schoolPeriodId: null,
        isActive: true
      }
    });

    const specificPermission = await GradeEditPermission.findOne({
      where: {
        grantedTo: sessionUser.id,
        schoolPeriodId: Number(schoolPeriodId),
        isActive: true
      }
    });

    if (!globalPermission && !specificPermission) {
      return res.status(403).json({ message: 'No tiene permiso para modificar notas de este período' });
    }

    // Get all inscriptions for this period
    const inscriptions = await Inscription.findAll({
      where: { schoolPeriodId: Number(schoolPeriodId) },
      include: [
        {
          model: Person,
          as: 'student',
          attributes: ['id', 'firstName', 'lastName', 'document']
        },
        {
          model: Grade,
          as: 'grade'
        },
        {
          model: Section,
          as: 'section'
        },
        {
          model: SchoolPeriod,
          as: 'period'
        }
      ],
      order: [
        [{ model: Person, as: 'student' }, 'lastName', 'ASC'],
        [{ model: Person, as: 'student' }, 'firstName', 'ASC']
      ]
    });

    console.log(`[getFinalGradesByPeriod] Period ID: ${schoolPeriodId}, Total inscriptions found: ${inscriptions.length}`);

    // Get all subjects for this period's grades
    const periodGrades = await PeriodGrade.findAll({
      where: { schoolPeriodId: Number(schoolPeriodId) },
      include: [
        {
          model: Subject,
          as: 'subjects'
        }
      ]
    });

    // Collect all subjects across all grades
    const allSubjects = periodGrades.flatMap(pg => (pg as any).subjects || []);
    console.log(`[getFinalGradesByPeriod] Total subjects found: ${allSubjects.length}`);

    // Build result array
    const result: any[] = [];

    // Cache orderMaps por gradeId (todas las inscripciones comparten schoolPeriodId)
    const orderMapCache = new Map<number, Map<number, number>>();
    const resolveOrderMap = async (gradeId: number | null | undefined) => {
      if (!gradeId) return new Map<number, number>();
      if (orderMapCache.has(gradeId)) return orderMapCache.get(gradeId)!;
      const map = await getSubjectOrderMapByGradeAndPeriod(gradeId, Number(schoolPeriodId));
      orderMapCache.set(gradeId, map);
      return map;
    };

    for (const inscription of inscriptions) {
      console.log(`[getFinalGradesByPeriod] Processing inscription: ${inscription.id}, Student: ${inscription.student?.firstName} ${inscription.student?.lastName}`);

      let inscriptionSubjects = await InscriptionSubject.findAll({
        where: { inscriptionId: inscription.id },
        include: [
          {
            model: Subject,
            as: 'subject'
          },
          {
            model: SubjectFinalGrade,
            as: 'finalGrade',
            required: false,
            attributes: ['id', 'inscriptionSubjectId', 'finalScore', 'rawScore', 'councilPoints', 'status', 'calculatedAt', 'plantelId', 'gradeType'],
            include: [{ model: Plantel, as: 'plantel', required: false }]
          }
        ]
      });

      console.log(`[getFinalGradesByPeriod] Inscription ${inscription.id} has ${inscriptionSubjects.length} subjects`);

      // If student has no subjects, create them based on their grade's subjects
      if (inscriptionSubjects.length === 0) {
        console.log(`[getFinalGradesByPeriod] Creating missing subjects for inscription ${inscription.id}`);

        const periodGrade = await PeriodGrade.findOne({
          where: { schoolPeriodId: Number(schoolPeriodId), gradeId: inscription.gradeId },
          include: [
            {
              model: Subject,
              as: 'subjects'
            }
          ]
        });

        if (periodGrade && (periodGrade as any).subjects) {
          const subjectsToCreate = (periodGrade as any).subjects.map((subject: any) => ({
            inscriptionId: inscription.id,
            subjectId: subject.id
          }));

          await InscriptionSubject.bulkCreate(subjectsToCreate);

          // Reload after creation
          inscriptionSubjects = await InscriptionSubject.findAll({
            where: { inscriptionId: inscription.id },
            include: [
              {
                model: Subject,
                as: 'subject'
              },
              {
                model: SubjectFinalGrade,
                as: 'finalGrade',
                required: false,
                attributes: ['id', 'inscriptionSubjectId', 'finalScore', 'rawScore', 'councilPoints', 'status', 'calculatedAt', 'plantelId', 'gradeType'],
                include: [{ model: Plantel, as: 'plantel', required: false }]
              }
            ]
          });

          console.log(`[getFinalGradesByPeriod] Created ${subjectsToCreate.length} subjects for inscription ${inscription.id}`);
        }
      }

      // Apply canonical subject order
      const orderMap = await resolveOrderMap(inscription.gradeId);
      inscriptionSubjects = sortSubjectsByOrder(
        inscriptionSubjects,
        (is: any) => is.subjectId,
        (is: any) => is.subject?.name,
        orderMap
      ) as typeof inscriptionSubjects;

      for (const insSubject of inscriptionSubjects) {
        const finalGrade = (insSubject as any).finalGrade;

        result.push({
          id: finalGrade?.id || null,
          inscriptionSubjectId: insSubject.id,
          finalScore: finalGrade?.finalScore || 0,
          rawScore: finalGrade?.rawScore || null,
          councilPoints: finalGrade?.councilPoints || null,
          status: finalGrade?.status || 'reprobada',
          calculatedAt: finalGrade?.calculatedAt || new Date(),
          plantelId: finalGrade?.plantelId || null,
          plantel: finalGrade?.plantel || null,
          gradeType: finalGrade?.gradeType || 'regular',
          inscriptionSubject: {
            id: insSubject.id,
            subject: insSubject.subject,
            inscription: inscription
          }
        });
      }
    }

    console.log(`[getFinalGradesByPeriod] Total records returned: ${result.length}`);

    res.json(result);
  } catch (error: any) {
    console.error('Error fetching final grades by period:', error);
    res.status(500).json({ message: 'Error al obtener notas finales', error: error.message });
  }
};

export const exportGradesExcel = async (req: Request, res: Response) => {
  try {
    const { assignmentId } = req.params;
    const { filled } = req.query;

    const assignment = await TeacherAssignment.findByPk(Number(assignmentId), {
      include: [
        {
          model: PeriodGradeSubject,
          as: 'periodGradeSubject',
          include: [
            { model: Subject, as: 'subject' },
            {
              model: PeriodGrade,
              as: 'periodGrade',
              include: [
                { model: Grade, as: 'grade' },
                { model: SchoolPeriod, as: 'schoolPeriod' }
              ]
            }
          ]
        },
        { model: Section, as: 'section' },
        { model: Person, as: 'teacher' }
      ]
    });

    if (!assignment) return res.status(404).json({ message: 'Asignación no encontrada' });

    const pg = await PeriodGrade.findByPk((assignment as any).periodGradeSubject.periodGradeId);
    if (!pg) return res.status(404).json({ message: 'Estructura no encontrada' });

    const evaluationPlans = await EvaluationPlan.findAll({
      where: { periodGradeSubjectId: assignment.periodGradeSubjectId, sectionId: assignment.sectionId },
      order: [['date', 'ASC']]
    });

    const inscriptions = await Inscription.findAll({
      where: {
        schoolPeriodId: pg.schoolPeriodId,
        sectionId: assignment.sectionId,
        [Op.or]: [{ gradeId: pg.gradeId }, { escolaridad: 'materia_pendiente' }]
      },
      include: [
        {
          model: Person,
          as: 'student',
          attributes: ['id', 'firstName', 'lastName', 'document']
        },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          where: { subjectId: (assignment as any).periodGradeSubject.subjectId },
          required: true,
          include: [
            {
              model: Qualification,
              as: 'qualifications',
              include: [{ model: EvaluationPlan, as: 'evaluationPlan' }]
            }
          ]
        }
      ],
      order: [
        [{ model: Person, as: 'student' }, 'lastName', 'ASC'],
        [{ model: Person, as: 'student' }, 'firstName', 'ASC']
      ]
    });

    const subject = (assignment as any).periodGradeSubject.subject;
    const section = (assignment as any).section;
    const grade = (assignment as any).periodGradeSubject.periodGrade.grade;
    const period = (assignment as any).periodGradeSubject.periodGrade.schoolPeriod;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Calificaciones');

    const totalCols = 3 + evaluationPlans.length + 1;
    const lastCol = sheet.getColumn(totalCols).letter;

    // Header info rows
    sheet.mergeCells(`A1:${lastCol}1`);
    const titleCell = sheet.getCell('A1');
    titleCell.value = `Plan de Evaluación - ${subject.name} - ${section.name}`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };

    sheet.mergeCells(`A2:${lastCol}2`);
    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = `${period.name} - ${grade.name}`;
    subtitleCell.font = { size: 11 };
    subtitleCell.alignment = { horizontal: 'center' };

    sheet.getRow(3).values = [];

    // Header row 1 (row 4): text labels + evaluation IDs
    const headerRow1 = sheet.getRow(4);
    headerRow1.getCell(1).value = 'Cédula';
    headerRow1.getCell(2).value = 'Apellidos';
    headerRow1.getCell(3).value = 'Nombres';

    let col = 4;
    evaluationPlans.forEach((plan: any) => {
      headerRow1.getCell(col).value = plan.identificador || plan.description;
      col++;
    });
    headerRow1.getCell(col).value = 'Total';

    // Merge name columns across rows 4-5
    sheet.mergeCells('A4:A5');
    sheet.mergeCells('B4:B5');
    sheet.mergeCells('C4:C5');
    // Merge Total column across rows 4-5
    const totalCol = sheet.getColumn(col).letter;
    sheet.mergeCells(`${totalCol}4:${totalCol}5`);

    // Header row 2 (row 5): percentages
    const headerRow2 = sheet.getRow(5);
    col = 4;
    evaluationPlans.forEach((plan: any) => {
      headerRow2.getCell(col).value = `${plan.percentage}%`;
      col++;
    });

    const headerStyle = (row: any) => {
      row.eachCell((cell: any) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      });
    };
    headerStyle(headerRow1);
    headerStyle(headerRow2);

    // Student rows
    let rowNum = 6;
    const isFilled = filled !== 'false';

    // Build formula parts for Total column
    const totalFormulaParts: string[] = [];
    evaluationPlans.forEach((plan: any, idx: number) => {
      const colLetter = sheet.getColumn(4 + idx).letter;
      const pct = Number(plan.percentage) / 100;
      totalFormulaParts.push(`${colLetter}{row}*${pct}`);
    });

    inscriptions.forEach((inscription: any) => {
      const row = sheet.getRow(rowNum);
      row.getCell(1).value = inscription.student?.document || '';
      row.getCell(2).value = inscription.student?.lastName || '';
      row.getCell(3).value = inscription.student?.firstName || '';

      const insSub = inscription.inscriptionSubjects?.[0];
      const studentQuals: any[] = insSub?.qualifications || [];

      let colNum = 4;
      let rowTotal = 0;
      evaluationPlans.forEach((plan: any) => {
        const q = studentQuals.find((sq: any) => sq.evaluationPlanId === plan.id);
        const cell = row.getCell(colNum);
        if (isFilled && q) {
          cell.value = Number(q.score);
          rowTotal += (Number(q.score) * Number(plan.percentage)) / 100;
        }
        cell.alignment = { horizontal: 'center' };
        cell.numFmt = '0.00';
        cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        colNum++;
      });

      const totalCell = row.getCell(colNum);
      const formula = totalFormulaParts.map(p => p.replace('{row}', String(rowNum))).join('+');
      if (isFilled) {
        totalCell.value = { formula, result: Math.round(rowTotal * 100) / 100 } as any;
      } else {
        totalCell.value = { formula } as any;
      }
      totalCell.numFmt = '0.00';
      totalCell.font = { bold: true };
      totalCell.alignment = { horizontal: 'center' };
      totalCell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

      // Apply borders to student name columns too
      for (let c = 1; c <= 3; c++) {
        row.getCell(c).border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
      }

      rowNum++;
    });

    // Column widths
    sheet.getColumn(1).width = 15;
    sheet.getColumn(2).width = 25;
    sheet.getColumn(3).width = 25;
    for (let i = 4; i <= 3 + evaluationPlans.length; i++) {
      sheet.getColumn(i).width = 14;
    }
    sheet.getColumn(4 + evaluationPlans.length).width = 10;

    const buffer = await workbook.xlsx.writeBuffer();

    const fileName = isFilled
      ? `calificaciones-${subject.name.replace(/\s+/g, '_')}.xlsx`
      : `plantilla-calificaciones-${subject.name.replace(/\s+/g, '_')}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('[exportGradesExcel] Error:', error);
    res.status(500).json({ message: error.message || 'Error al exportar calificaciones' });
  }
};
