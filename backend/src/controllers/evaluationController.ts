import { Request, Response } from 'express';
import { Op } from 'sequelize';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
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
  Plantel,
  QualificationAudit,
  Setting,
  EvaluationCriteria,
  ThematicComponent,
  ThematicContent,
  EvaluationIndicator,
  EvaluationCatalog,
  ExpectedLearning
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
                  where: { status: 'activo' } // Only active period
                }
              ]
            }
          ]
        },
        { model: Section, as: 'section' },
        { model: Person, as: 'teacher' }
      ],
    });

    // Sort by PeriodGradeSubject.order (canonical subject order), then by grade name, then by section name
    const sorted = assignments.sort((a: any, b: any) => {
      const orderA = a.periodGradeSubject?.order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.periodGradeSubject?.order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      const gradeA = a.periodGradeSubject?.periodGrade?.grade?.name || '';
      const gradeB = b.periodGradeSubject?.periodGrade?.grade?.name || '';
      if (gradeA !== gradeB) return gradeA.localeCompare(gradeB, 'es');
      const secA = a.section?.name || '';
      const secB = b.section?.name || '';
      return secA.localeCompare(secB, 'es');
    });

    res.json(sorted);
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
    if (term) where.termId = term;
    if (sectionId) where.sectionId = sectionId;

    const plan = await EvaluationPlan.findAll({
      where,
      include: [
        { model: EvaluationCriteria, as: 'criteria', include: [
          { model: EvaluationIndicator, as: 'indicators' }
        ] },
        { model: ThematicComponent, as: 'thematicComponent' },
        { model: EvaluationCatalog, as: 'tecnicaCatalog' },
        { model: EvaluationCatalog, as: 'instrumentoCatalog' },
        { model: EvaluationCatalog, as: 'estrategiaCatalog' },
      ],
      order: [['date', 'ASC']]
    });

    // Resolve thematicContentIds to content objects
    const allContentIds = plan.flatMap((p: any) =>
      Array.isArray(p.thematicContentIds) ? p.thematicContentIds : []
    );
    let contentMap = new Map<number, any>();
    if (allContentIds.length > 0) {
      const contents = await ThematicContent.findAll({
        where: { id: allContentIds },
        include: [{ model: ThematicComponent, as: 'thematicComponent', attributes: ['id', 'title'] }]
      });
      contents.forEach((c: any) => contentMap.set(c.id, c.toJSON()));
    }

    const planWithContents = plan.map((p: any) => {
      const j = p.toJSON();
      j.thematicContents = (Array.isArray(j.thematicContentIds) ? j.thematicContentIds : [])
        .map((id: number) => contentMap.get(id))
        .filter(Boolean);
      return j;
    });

    res.json(planWithContents);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener plan de evaluación' });
  }
};

export const createEvaluationItem = async (req: Request, res: Response) => {
  try {
    const { termId, periodGradeSubjectId, sectionId, description, percentage, date, thematicComponentId, thematicContentIds, evaluationType, criteria, tecnicaId, instrumentoId, estrategiaId, shortDescription } = req.body;
    const normalizedThematicContentIds = Array.isArray(thematicContentIds)
      ? [...new Set(thematicContentIds.map(Number).filter(Number.isInteger))]
      : null;

    const validTypes = ['intra', 'inter', 'trans'];
    const typesArray = Array.isArray(evaluationType)
      ? evaluationType.filter((t: string) => validTypes.includes(t))
      : (typeof evaluationType === 'string' && evaluationType ? evaluationType.split(',').filter((t: string) => validTypes.includes(t.trim())) : []);
    if (typesArray.length === 0) {
      return res.status(400).json({ message: 'Debe seleccionar al menos un tipo de evaluación' });
    }
    const evaluationTypeStr = typesArray.join(',');

    if (termId) {
      const term = await Term.findByPk(termId);
      if (!term) {
        return res.status(404).json({ message: 'Lapso no encontrado' });
      }
      if (term.isBlocked) {
        return res.status(403).json({ message: 'Lapso bloqueado; no se pueden modificar el plan de evaluación' });
      }
    }

    // Validate percentage sum does not exceed 100
    const currentSum = await EvaluationPlan.sum('percentage', {
      where: { periodGradeSubjectId, sectionId, termId },
    }) as number || 0;
    if (Number(currentSum) + Number(percentage) > 100) {
      return res.status(400).json({ message: 'La suma de los porcentajes para este lapso no puede superar el 100%' });
    }

    const item = await EvaluationPlan.create({
      periodGradeSubjectId,
      sectionId,
      termId,
      description,
      percentage,
      date,
      thematicComponentId: thematicComponentId || null,
      thematicContentIds: normalizedThematicContentIds,
      evaluationType: evaluationTypeStr,
      tecnicaId: tecnicaId || null,
      instrumentoId: instrumentoId || null,
      estrategiaId: estrategiaId || null,
      shortDescription: shortDescription || null,
    });

    // Create criteria if provided
    if (Array.isArray(criteria) && criteria.length > 0) {
      for (const c of criteria) {
        const criterion = await EvaluationCriteria.create({
          evaluationPlanId: item.id,
          name: c.name,
          points: c.points,
        });
        if (Array.isArray(c.indicators) && c.indicators.length > 0) {
          await EvaluationIndicator.bulkCreate(
            c.indicators.map((ind: any) => ({
              evaluationCriteriaId: criterion.id,
              name: ind.name,
              points: ind.points,
            }))
          );
        }
      }
    }

    // Return with criteria included
    const fullItem = await EvaluationPlan.findByPk(item.id, {
      include: [
        { model: EvaluationCriteria, as: 'criteria', include: [
          { model: EvaluationIndicator, as: 'indicators' }
        ] },
        { model: ThematicComponent, as: 'thematicComponent' },
        { model: EvaluationCatalog, as: 'tecnicaCatalog' },
        { model: EvaluationCatalog, as: 'instrumentoCatalog' },
        { model: EvaluationCatalog, as: 'estrategiaCatalog' },
      ],
    });
    res.json(fullItem);
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

    // Validate percentage sum if percentage is being updated
    if (req.body.percentage !== undefined) {
      const currentSum = await EvaluationPlan.sum('percentage', {
        where: {
          periodGradeSubjectId: item.periodGradeSubjectId,
          sectionId: item.sectionId,
          termId: item.termId,
          id: { [Op.ne]: Number(id) }
        }
      }) as number || 0;
      if (Number(currentSum) + Number(req.body.percentage) > 100) {
        return res.status(400).json({ message: 'La suma de los porcentajes para este lapso no puede superar el 100%' });
      }
    }

    const { criteria, evaluationType, ...updateFields } = req.body;

    if (evaluationType !== undefined) {
      const validTypes = ['intra', 'inter', 'trans'];
      const typesArray = Array.isArray(evaluationType)
        ? evaluationType.filter((t: string) => validTypes.includes(t))
        : (typeof evaluationType === 'string' && evaluationType ? evaluationType.split(',').filter((t: string) => validTypes.includes(t.trim())) : []);
      if (typesArray.length === 0) {
        return res.status(400).json({ message: 'Debe seleccionar al menos un tipo de evaluación' });
      }
      updateFields.evaluationType = typesArray.join(',');
    }

    await item.update(updateFields);

    // Replace criteria if provided
    if (Array.isArray(criteria)) {
      await EvaluationCriteria.destroy({ where: { evaluationPlanId: Number(id) } });
      if (criteria.length > 0) {
        for (const c of criteria) {
          const criterion = await EvaluationCriteria.create({
            evaluationPlanId: Number(id),
            name: c.name,
            points: c.points,
          });
          if (Array.isArray(c.indicators) && c.indicators.length > 0) {
            await EvaluationIndicator.bulkCreate(
              c.indicators.map((ind: any) => ({
                evaluationCriteriaId: criterion.id,
                name: ind.name,
                points: ind.points,
              }))
            );
          }
        }
      }
    }

    const fullItem = await EvaluationPlan.findByPk(id, {
      include: [
        { model: EvaluationCriteria, as: 'criteria', include: [
          { model: EvaluationIndicator, as: 'indicators' }
        ] },
        { model: ThematicComponent, as: 'thematicComponent' },
        { model: EvaluationCatalog, as: 'tecnicaCatalog' },
        { model: EvaluationCatalog, as: 'instrumentoCatalog' },
        { model: EvaluationCatalog, as: 'estrategiaCatalog' },
      ],
    });
    res.json(fullItem);
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

    const { periodGradeSubject, sectionId, teacherId } = assignment as any;

    // Determine the assigned professor's user id to detect edits by other users
    let professorUserId: number | null = null;
    if (teacherId) {
      const teacherPerson = await Person.findByPk(teacherId, { attributes: ['userId'] });
      professorUserId = (teacherPerson as any)?.userId ?? null;
    }

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
              include: [
                { model: EvaluationPlan, as: 'evaluationPlan', include: [{ model: EvaluationCriteria, as: 'criteria' }] },
                {
                  model: QualificationAudit,
                  as: 'audits',
                  include: [
                    {
                      model: User,
                      as: 'editor',
                      attributes: ['id', 'username'],
                      include: [{ model: Person, as: 'person', attributes: ['firstName', 'lastName'] }]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    });

    // Process audit flags in nested qualifications
    const parsed = (inscriptions as any[]).map(ins => {
      const j = ins.toJSON() as any;
      if (j.inscriptionSubjects) {
        j.inscriptionSubjects.forEach((is: any) => {
          if (is.qualifications) {
            is.qualifications.forEach((q: any) => {
              const foreignAudits = Array.isArray(q.audits)
                ? q.audits.filter((a: any) =>
                    a.editedBy !== professorUserId || a.editorContext === 'control_estudios'
                  )
                : [];
              q.editedByOther = foreignAudits.length > 0;
              if (q.editedByOther) {
                const last = [...foreignAudits].sort(
                  (a: any, b: any) => new Date(b.editedAt).getTime() - new Date(a.editedAt).getTime()
                )[0];
                const editorPerson = last?.editor?.person;
                q.lastEditDate = last?.editedAt ?? null;
                q.lastEditUser = editorPerson
                  ? `${editorPerson.firstName || ''} ${editorPerson.lastName || ''}`.trim()
                  : last?.editor?.username || '';
              }
              delete q.audits;
            });
          }
        });
      }
      return j;
    });

    res.json(parsed);
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
    const { evaluationPlanId, inscriptionSubjectId, score, remedialScore, isAbsent, observations, inscriptionId } = req.body;

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
      defaults: {
        evaluationPlanId,
        inscriptionSubjectId: finalInscriptionSubjectId,
        score: score !== undefined ? score : 0,
        remedialScore: remedialScore !== undefined ? remedialScore : null,
        isAbsent: isAbsent || false,
        observations
      }
    });

    if (!created) {
      const previousScore = qualification.score;
      
      const updateData: any = { observations };
      if (score !== undefined) updateData.score = score;
      if (remedialScore !== undefined) updateData.remedialScore = remedialScore;
      if (isAbsent !== undefined) updateData.isAbsent = isAbsent;

      await qualification.update(updateData);

      // Record audit if score changed
      const sessionUser = (req.session as any).user;
      if (sessionUser && score !== undefined && Number(previousScore) !== Number(score)) {
        const userRoles: string[] = sessionUser.roles || [];
        const editorContext = userRoles.includes('Control de Estudios') ? 'control_estudios' : 'teacher';
        await QualificationAudit.create({
          qualificationId: qualification.id,
          editedBy: sessionUser.id,
          previousScore,
          newScore: score,
          comment: typeof req.body.comment === 'string' && req.body.comment.trim() !== '' ? req.body.comment.trim() : null,
          editedAt: new Date(),
          editorContext,
        });
      }
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

      if (schoolPeriod.status === 'activo') {
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
    console.log('[updateFinalGrade] School period:', schoolPeriod?.id, schoolPeriod?.name, 'status:', schoolPeriod?.status);
    if (!schoolPeriod) {
      console.log('[updateFinalGrade] School period not found');
      return res.status(400).json({ message: 'No se pudo determinar el período escolar' });
    }

    if (schoolPeriod.status === 'activo') {
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

export const exportPlanningExcel = async (req: Request, res: Response) => {
  try {
    const assignmentId = Number(req.params.assignmentId);
    const termId = req.query.term ? Number(req.query.term) : null;
    const assignment = await TeacherAssignment.findByPk(assignmentId, {
      include: [
        { model: Person, as: 'teacher' },
        { model: Section, as: 'section' },
        {
          model: PeriodGradeSubject,
          as: 'periodGradeSubject',
          include: [
            { model: Subject, as: 'subject' },
            { model: PeriodGrade, as: 'periodGrade', include: [{ model: Grade, as: 'grade' }, { model: SchoolPeriod, as: 'schoolPeriod' }] },
          ],
        },
      ],
    });
    if (!assignment) return res.status(404).json({ message: 'Asignación no encontrada' });

    const assignmentData = assignment as any;
    const pgs = assignmentData.periodGradeSubject;
    const periodGrade = pgs.periodGrade;
    const [term, components, plans] = await Promise.all([
      termId ? Term.findByPk(termId) : Promise.resolve(null),
      ThematicComponent.findAll({
        where: { periodGradeSubjectId: pgs.id, sectionId: assignmentData.sectionId, ...(termId ? { termId } : {}) },
        include: [{ model: ThematicContent, as: 'contents', include: [{ model: ExpectedLearning, as: 'learnings' }] }],
        order: [['order', 'ASC']],
      }),
      EvaluationPlan.findAll({
        where: { periodGradeSubjectId: pgs.id, sectionId: assignmentData.sectionId, ...(termId ? { termId } : {}) },
        include: [
          { model: EvaluationCriteria, as: 'criteria', include: [{ model: EvaluationIndicator, as: 'indicators' }] },
          { model: EvaluationCatalog, as: 'tecnicaCatalog' },
          { model: EvaluationCatalog, as: 'instrumentoCatalog' },
        ],
        order: [['date', 'ASC']],
      }),
    ]);

    // Build a map: contentId → { componentIndex, contentIndex, componentTitle, contentTitle, learningIndices }
    const contentMap = new Map<number, { componentIndex: number; contentIndex: number; componentTitle: string; contentTitle: string; learningIndices: string[]; learningDescriptions: string[] }>();
    components.forEach((component: any, compIdx: number) => {
      const componentData = component.toJSON();
      const orderedContents = componentData.contents || [];
      orderedContents.forEach((content: any, contentIdx: number) => {
        const learningIndices = [`${compIdx + 1}.${contentIdx + 1}`];
        const learningDescriptions: string[] = [];
        (content.learnings || []).forEach((l: any) => learningDescriptions.push(l.description));
        contentMap.set(content.id, {
          componentIndex: compIdx,
          contentIndex: contentIdx,
          componentTitle: componentData.title,
          contentTitle: content.title,
          learningIndices,
          learningDescriptions,
        });
      });
    });

    const thematicRows = components.map((component: any, componentIndex: number) => {
      const componentData = component.toJSON();
      const contents = componentData.contents || [];
      return {
        component: `${componentIndex + 1}. ${componentData.title}`,
        content: contents.map((content: any, contentIndex: number) => `${componentIndex + 1}.${contentIndex + 1} ${content.title}`).join('\n'),
        learnings: [...new Set(contents.flatMap((content: any) =>
          (content.learnings || []).map((learning: any) => `• ${learning.description}`)
        ))].join('\n'),
      };
    });

    const componentNames = new Map<number, string>();
    components.forEach((component: any, componentIndex: number) => {
      const componentData = component.toJSON();
      componentNames.set(componentData.id, `${componentIndex + 1}. ${componentData.title}`);
    });
    const formatPlanDate = (value: string | Date | null | undefined) => {
      if (!value) return '';
      const datePart = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
      const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      return match ? `${match[3]}/${match[2]}/${match[1]}` : datePart;
    };
    const orderedPlans = plans.map((plan: any) => {
      const planData = plan.toJSON();
      const contentIds = Array.isArray(plan.thematicContentIds) ? plan.thematicContentIds : [];
      const linkedContents = contentIds
        .map((id: number) => contentMap.get(id))
        .filter(Boolean)
        .sort((a: any, b: any) => (a.componentIndex - b.componentIndex) || (a.contentIndex - b.contentIndex));
      const linkedComponents = [...new Set(linkedContents.map((content: any) =>
        `${content.componentIndex + 1}. ${content.componentTitle}`
      ))];
      if (linkedComponents.length === 0 && plan.thematicComponentId) {
        const componentName = componentNames.get(plan.thematicComponentId);
        if (componentName) linkedComponents.push(componentName);
      }
      const indices = [...new Set(linkedContents.flatMap((content: any) => content.learningIndices))];
      return {
        ...planData,
        componentNames: linkedComponents.join('\n'),
        indicesStr: indices.length > 0 ? `(${indices.join(', ')})` : '',
      };
    }).sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));

    const evaluationRows = orderedPlans.flatMap((plan: any) => {
      const planRows: any[] = [];
      const criteria = plan.criteria || [];
      if (criteria.length === 0) {
        planRows.push({ plan, criterion: null, indicator: null, criterionRowIndex: 0, criterionRowCount: 1 });
      } else {
        criteria.forEach((criterion: any) => {
          const indicators = criterion.indicators?.length ? criterion.indicators : [null];
          indicators.forEach((indicator: any, criterionRowIndex: number) => {
            planRows.push({
              plan,
              criterion,
              indicator,
              criterionRowIndex,
              criterionRowCount: indicators.length,
            });
          });
        });
      }
      return planRows.map((detail, planRowIndex) => ({
        ...detail,
        planRowIndex,
        planRowCount: planRows.length,
      }));
    });

    const thematicSpanSizes = thematicRows.map((row: any) => Math.max(
      1,
      row.content ? row.content.split('\n').length : 0,
      row.learnings ? row.learnings.split('\n').length : 0
    ));
    const thematicUnits = thematicSpanSizes.reduce((sum: number, size: number) => sum + size, 0);
    const rowCount = Math.max(1, thematicUnits, evaluationRows.length);
    for (let index = 0; index < rowCount - thematicUnits && thematicSpanSizes.length > 0; index++) {
      thematicSpanSizes[index % thematicSpanSizes.length]++;
    }
    let thematicStartIndex = 0;
    const thematicSpans = thematicRows.map((data: any, index: number) => {
      const size = thematicSpanSizes[index];
      const span = { data, startIndex: thematicStartIndex, endIndex: thematicStartIndex + size - 1 };
      thematicStartIndex += size;
      return span;
    });
    const thematicRowsByStart = new Map(thematicSpans.map((span: any) => [span.startIndex, span.data]));

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Planificación');
    const planningLogoPath = path.resolve(process.cwd(), 'public', 'uploads', 'images', 'LogoMinisterio_H.svg');
    const planningLogoId = fs.existsSync(planningLogoPath)
      ? workbook.addImage({ filename: planningLogoPath, extension: 'svg' as 'png' })
      : null;
    const border = { style: 'thin' as const, color: { argb: 'FF666666' } };
    const tableSeparator = { style: 'medium' as const, color: { argb: 'FF333333' } };
    const outerBorder = { style: 'medium' as const, color: { argb: 'FF000000' } };
    const criterionSeparatorBorder = { style: 'thin' as const, color: { argb: 'FFA6A6A6' } };
    const instrumentSeparatorBorder = { style: 'thin' as const, color: { argb: 'FF000000' } };
    const headerFill = 'FFD9E2F3';
    const groupFill = 'FFB4C6E7';
    const evaluationHeaderFill = 'FFF2F2F2';
    const columns = [
      ['COMPONENTE TEMÁTICO', 24], ['CONTENIDO', 28], ['APRENDIZAJES ESPERADOS', 32], ['ESTRATEGIA DE APRENDIZAJE', 28],
      ['TÉCNICA', 18], ['INSTRUMENTO', 18], ['CRITERIOS', 28], ['INDICADORES', 30], ['PUNTOS', 3.71], ['', 3.71],
      ['INTRA', 5.71], ['INTER', 5.71], ['TRANS', 5.71], ['FECHA', 14], ['PORCENTAJE', 12],
    ];
    columns.forEach(([name, width], index) => { sheet.getColumn(index + 1).width = width as number; });

    sheet.getRow(1).height = 95.25;
    sheet.getRow(2).height = 24.75;
    sheet.getRow(3).height = 16;
    sheet.getRow(4).height = 24.75;
    sheet.getRow(5).height = 24.75;
    sheet.getRow(6).height = 24.75;
    sheet.getRow(7).height = 15;
    sheet.getRow(8).height = 15;

    sheet.mergeCells('A1:D1');
    if (planningLogoId !== null) {
      sheet.addImage(planningLogoId, {
        tl: { col: 0.238125, row: 0.06 },
        ext: { width: 120 * (1140 / 185), height: 120 },
        editAs: 'absolute',
      });
    }

    sheet.mergeCells('A2:O2');
    sheet.getCell('A2').value = 'PLANIFICACIÓN';
    sheet.getCell('A2').font = { bold: true, size: 16 };
    sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.getCell('A3').value = 'PEIC: ________________________';
    sheet.getCell('B3').value = 'PA: ________________________';
    sheet.getCell('A3').font = { size: 9 };
    sheet.getCell('B3').font = { size: 9 };

    sheet.mergeCells('A4:C4');
    sheet.mergeCells('D4:O4');
    sheet.getCell('A4').value = term?.getDataValue('name') || 'Lapso';
    sheet.getCell('A4').font = { bold: true, size: 14 };
    sheet.getCell('A4').alignment = { horizontal: 'left', vertical: 'middle' };
    const periodName = String(periodGrade.schoolPeriod?.name || '');
    const schoolYear = periodName.match(/\d{4}\s*-\s*\d{4}/)?.[0] || periodName;
    sheet.getCell('D4').value = `Año Escolar: ${schoolYear}`;
    sheet.getCell('D4').font = { bold: true, size: 14 };
    sheet.getCell('D4').alignment = { horizontal: 'right', vertical: 'middle' };

    const sectionName = String(assignmentData.section?.name || '').replace(/^Secci[oó]n\s*/i, '');
    sheet.getCell('A5').value = 'Profesor:';
    sheet.getCell('A5').font = { size: 14 };
    sheet.mergeCells('B5:O5');
    sheet.getCell('B5').value = assignmentData.teacher
      ? `${assignmentData.teacher.firstName} ${assignmentData.teacher.lastName}`
      : '—';
    sheet.getCell('B5').font = { bold: true, size: 14 };
    sheet.getCell('B5').alignment = { horizontal: 'left', vertical: 'middle' };

    sheet.getCell('A6').value = 'Área de Formación:';
    sheet.getCell('A6').font = { size: 14 };
    sheet.mergeCells('B6:C6');
    sheet.getCell('B6').value = pgs.subject?.name || '';
    sheet.getCell('B6').font = { bold: true, size: 14 };
    sheet.getCell('B6').alignment = { horizontal: 'left', vertical: 'middle' };
    sheet.mergeCells('D6:O6');
    sheet.getCell('D6').value = `${periodGrade.grade?.name || ''}${sectionName ? `, sección ${sectionName}` : ''}`;
    sheet.getCell('D6').font = { bold: true, size: 14 };
    sheet.getCell('D6').alignment = { horizontal: 'left', vertical: 'middle' };

    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'N', 'O'].forEach((column) => {
      sheet.mergeCells(`${column}7:${column}8`);
    });
    sheet.mergeCells('I7:J8');
    sheet.mergeCells('K7:M7');
    ['A7', 'B7', 'C7', 'D7', 'E7', 'F7', 'G7', 'H7'].forEach((cell, index) => {
      sheet.getCell(cell).value = columns[index][0];
    });
    sheet.getCell('I7').value = 'PUNTOS';
    sheet.getCell('I7').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    sheet.getCell('K7').value = 'TIPO DE EVALUACIÓN';
    sheet.getCell('K7').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    ['K8', 'L8', 'M8'].forEach((cell, index) => { sheet.getCell(cell).value = columns[index + 10][0]; });
    sheet.getCell('N7').value = columns[13][0];
    sheet.getCell('O7').value = columns[14][0];
    for (let row = 7; row <= 8; row++) {
      for (let col = 1; col <= 15; col++) {
        const cell = sheet.getCell(row, col);
        cell.font = { bold: true, size: 9 };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: col >= 4 ? evaluationHeaderFill : row === 7 ? groupFill : headerFill },
        };
        cell.border = {
          top: border,
          bottom: border,
          left: col === 4 ? tableSeparator : border,
          right: col === 3 ? tableSeparator : border,
        };
      }
    }

    for (let index = 0; index < rowCount; index++) {
      const row = sheet.getRow(9 + index);
      const thematicData = thematicRowsByStart.get(index) as any;
      const evaluationData = evaluationRows[index];
      const planData = evaluationData?.plan;
      const criterion = evaluationData?.criterion;
      const indicator = evaluationData?.indicator;
      const isFirstPlanRow = evaluationData?.planRowIndex === 0;
      const isFirstCriterionRow = evaluationData?.criterionRowIndex === 0;
      const types = planData
        ? (planData.evaluationType || '').split(',').filter(Boolean).map((type: string) => type.toUpperCase())
        : [];
      const strategyValue: any = (() => {
        if (!planData || !isFirstPlanRow) return '';
        const richText: { font: Partial<ExcelJS.Font>; text: string }[] = [];
        if (planData.description) richText.push({ font: { size: 11 }, text: planData.description });
        if (planData.componentNames) {
          richText.push({ font: { size: 11, italic: true, color: { argb: 'FF888888' } }, text: `\n${planData.componentNames}` });
        }
        if (planData.indicesStr) {
          richText.push({ font: { size: 11, color: { argb: 'FF555555' } }, text: `\n${planData.indicesStr}` });
        }
        return richText.length > 0 ? { richText } : '';
      })();
      const criterionTotalPoints = criterion
        ? (criterion.indicators || []).reduce((sum: number, ind: any) => sum + Number(ind?.points || 0), 0)
        : '';
      const values = [
        thematicData?.component || '', thematicData?.content || '', thematicData?.learnings || '',
        strategyValue,
        isFirstPlanRow ? planData?.tecnicaCatalog?.name || '' : '',
        isFirstPlanRow ? planData?.instrumentoCatalog?.name || '' : '',
        isFirstCriterionRow ? criterion?.name || '' : '',
        indicator?.name || '',
        indicator?.points != null ? Number(indicator.points) : '',
        isFirstCriterionRow ? criterionTotalPoints : '',
        isFirstPlanRow && types.includes('INTRA') ? 'X' : '',
        isFirstPlanRow && types.includes('INTER') ? 'X' : '',
        isFirstPlanRow && types.includes('TRANS') ? 'X' : '',
        isFirstPlanRow ? formatPlanDate(planData?.date) : '',
        isFirstPlanRow && planData ? `${Number(planData.percentage)}%` : '',
      ];
      values.forEach((value, col) => {
        const cell = row.getCell(col + 1);
        cell.value = value;
        cell.alignment = (col === 4 || col === 5)
          ? { horizontal: 'center', vertical: 'middle', wrapText: true }
          : { vertical: 'middle', wrapText: true };
        cell.border = {
          top: border,
          bottom: border,
          left: col === 3 ? tableSeparator : border,
          right: col === 2 ? tableSeparator : border,
        };
      });
      row.height = 15;
    }

    thematicSpans.forEach((span: any) => {
      const startRow = 9 + span.startIndex;
      const endRow = 9 + span.endIndex;
      if (endRow > startRow) {
        ['A', 'B', 'C'].forEach((column) => {
          sheet.mergeCells(`${column}${startRow}:${column}${endRow}`);
          sheet.getCell(`${column}${startRow}`).alignment = { vertical: 'middle', wrapText: true };
        });
      }
    });

    evaluationRows.forEach((evaluationData: any, index: number) => {
      const startRow = 9 + index;
      if (evaluationData.planRowIndex === 0 && evaluationData.planRowCount > 1) {
        const endRow = startRow + evaluationData.planRowCount - 1;
        ['D', 'E', 'F', 'K', 'L', 'M', 'N', 'O'].forEach((column) => {
          sheet.mergeCells(`${column}${startRow}:${column}${endRow}`);
          const isEF = column === 'E' || column === 'F';
          sheet.getCell(`${column}${startRow}`).alignment = isEF
            ? { horizontal: 'center', vertical: 'middle', wrapText: true }
            : { vertical: 'middle', wrapText: true };
        });
      }
      if (evaluationData.criterionRowIndex === 0 && evaluationData.criterionRowCount > 1) {
        const endRow = startRow + evaluationData.criterionRowCount - 1;
        sheet.mergeCells(`G${startRow}:G${endRow}`);
        sheet.getCell(`G${startRow}`).alignment = { vertical: 'middle', wrapText: true };
        sheet.mergeCells(`J${startRow}:J${endRow}`);
        sheet.getCell(`J${startRow}`).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      }
    });

    const lastTableRow = 8 + rowCount;
    for (let rowIndex = 1; rowIndex <= lastTableRow; rowIndex++) {
      const row = sheet.getRow(rowIndex);
      if (rowIndex >= 7) row.height = 15;
      for (let columnIndex = 1; columnIndex <= 15; columnIndex++) {
        const cell = row.getCell(columnIndex);
        const isMergedSlave = cell.isMerged && cell.master.address !== cell.address;
        if (!isMergedSlave) {
          cell.alignment = {
            ...(cell.alignment || {}),
            vertical: 'middle',
            ...(columnIndex === 9 || columnIndex === 10 || (columnIndex >= 11 && rowIndex >= 9)
              ? { horizontal: 'center' as const }
              : {}),
          };
        }
        if (rowIndex >= 7) {
          const currentBorder = cell.border || {};
          cell.border = {
            top: rowIndex === 7 ? outerBorder : currentBorder.top,
            bottom: rowIndex === 8 || rowIndex === lastTableRow ? outerBorder : currentBorder.bottom,
            left: columnIndex === 1 ? outerBorder : currentBorder.left,
            right: columnIndex === 15 ? outerBorder : currentBorder.right,
          };
        }
      }
    }

    evaluationRows.forEach((evaluationData: any, index: number) => {
      const rowIndex = 9 + index;
      const isPlanEnd = evaluationData.planRowIndex === evaluationData.planRowCount - 1;
      const isCriterionEnd = evaluationData.criterionRowIndex === evaluationData.criterionRowCount - 1;
      if (rowIndex >= lastTableRow) return;
      if (!isCriterionEnd) {
        for (let columnIndex = 8; columnIndex <= 10; columnIndex++) {
          const cell = sheet.getCell(rowIndex, columnIndex);
          const currentBorder = { ...(cell.border || {}) };
          delete currentBorder.bottom;
          cell.border = currentBorder;
          const nextCell = sheet.getCell(rowIndex + 1, columnIndex);
          const nextBorder = { ...(nextCell.border || {}) };
          delete nextBorder.top;
          nextCell.border = nextBorder;
        }
        return;
      }
      const separatorBorder = isPlanEnd ? instrumentSeparatorBorder : criterionSeparatorBorder;
      for (let columnIndex = 7; columnIndex <= 10; columnIndex++) {
        const cell = sheet.getCell(rowIndex, columnIndex);
        const borderCell = (columnIndex === 7 || columnIndex === 10) ? cell.master : cell;
        borderCell.border = { ...(borderCell.border || {}), bottom: separatorBorder };
        const nextCell = sheet.getCell(rowIndex + 1, columnIndex);
        const nextBorderCell = (columnIndex === 7 || columnIndex === 10) ? nextCell.master : nextCell;
        nextBorderCell.border = { ...(nextBorderCell.border || {}), top: separatorBorder };

        if (columnIndex === 7 || columnIndex === 10) {
          cell.border = { ...(cell.border || {}), bottom: separatorBorder };
          nextCell.border = { ...(nextCell.border || {}), top: separatorBorder };
        }
      }
    });

    for (let rowIndex = 7; rowIndex <= lastTableRow; rowIndex++) {
      for (let columnIndex = 1; columnIndex <= 15; columnIndex++) {
        const cell = sheet.getCell(rowIndex, columnIndex);
        const currentBorder = { ...(cell.border || {}) };
        cell.border = {
          ...currentBorder,
          top: rowIndex === 7 ? outerBorder : currentBorder.top,
          bottom: rowIndex === lastTableRow ? outerBorder : currentBorder.bottom,
          left: columnIndex === 1 ? outerBorder : currentBorder.left,
          right: columnIndex === 15 ? outerBorder : currentBorder.right,
        };
      }
    }

    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
    sheet.pageSetup.horizontalCentered = true;
    sheet.headerFooter.oddFooter = 'Página &P de &N';

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="planificacion-${assignmentId}.xlsx"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('[exportPlanningExcel] Error:', error);
    res.status(500).json({ message: 'Error al generar Excel de planificación' });
  }
};

export const exportGradesExcelOficial = async (req: Request, res: Response) => {
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

    const termId = req.query.term ? Number(req.query.term) : null;
    let termName = '';
    if (termId) {
      const term = await Term.findByPk(termId);
      termName = term ? term.getDataValue('name') : '';
    }

    const evaluationPlans = await EvaluationPlan.findAll({
      where: {
        periodGradeSubjectId: assignment.periodGradeSubjectId,
        sectionId: assignment.sectionId,
        ...(termId ? { termId } : {})
      },
      order: [['date', 'ASC']]
    });

    const [institutionShortName, institutionCode] = await Promise.all([
      Setting.findOne({ where: { key: 'institution_short_name' } }),
      Setting.findOne({ where: { key: 'institution_code' } })
    ]);
    const instName = institutionShortName?.getDataValue('value') || '';
    const studyModeCode = institutionCode?.getDataValue('value') || '';

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
        [{ model: Person, as: 'student' }, 'document', 'ASC']
      ]
    });

    // Sort by numeric part of document (ascending)
    inscriptions.sort((a: any, b: any) => {
      const parseDoc = (doc: string) => parseInt((doc || '').replace(/\D/g, ''), 10) || 0;
      return parseDoc(a.student?.document) - parseDoc(b.student?.document);
    });

    const subject = (assignment as any).periodGradeSubject.subject;
    const section = (assignment as any).section;
    const grade = (assignment as any).periodGradeSubject.periodGrade.grade;
    const period = (assignment as any).periodGradeSubject.periodGrade.schoolPeriod;

    const workbook = new ExcelJS.Workbook();
    (workbook as any).font = { name: 'Calibri', size: 9 };
    const sheet = workbook.addWorksheet('Calificaciones');

    // Column layout:
    // 1 = #, 2 = CÉDULA, 3-4 = APELLIDOS Y NOMBRES (merged C+D),
    // per evaluation: 3 cols (NOT | REM | %),
    // then DEF, then Observaciones
    const nEvals = evaluationPlans.length;
    const firstEvalCol = 5;
    const defCol = firstEvalCol + nEvals * 3;
    const obsCol = defCol + 1;
    const totalCols = obsCol;
    const lastColLetter = sheet.getColumn(totalCols).letter;

    const thinBorder = {
      top: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      left: { style: 'thin' as const },
      right: { style: 'thin' as const }
    };
    const thickSide = { style: 'medium' as const };
    const thinSide2 = { style: 'thin' as const };

    const DARK_BLUE = 'FF1F3864';
    const MED_BLUE = 'FF2E5FA3';
    const GRAY = 'FFD9D9D9';
    const LIGHT_GREEN = 'FFE2EFDA';
    const ZEBRA = 'FFF2F5FA';

    // ── Encabezado institucional (filas 1-7) ──────────────────
    // Logo: merged block A1:B7, logo centered within
    sheet.mergeCells('A1:B7');
    try {
      const uploadDir = path.join(__dirname, '../../public/uploads/images');
      const logoFile = fs.existsSync(path.join(uploadDir, 'institution_logo.png'))
        ? 'institution_logo.png'
        : fs.readdirSync(uploadDir).find((f: string) => f.startsWith('institution_logo'));
      if (logoFile) {
        const ext = logoFile.split('.').pop()?.toLowerCase() as 'jpeg' | 'png' | 'gif' | undefined;
        if (ext) {
          const imageId = workbook.addImage({ filename: path.join(uploadDir, logoFile), extension: ext });
          sheet.addImage(imageId, { tl: { col: 0.22, row: 0.53 }, ext: { width: 105.6, height: 105.6 } });
        }
      }
    } catch { /* logo opcional */ }

    // Left block (institution name + period) spans cols C..D, rows 1-2 / 3
    sheet.mergeCells('C1:D2');
    const instCell = sheet.getCell('C1');
    instCell.value = instName || 'U.E.C. BATALLA DE LA VICTORIA';
    instCell.font = { bold: true, size: 18 };
    instCell.alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells('C3:D3');
    const periodCell = sheet.getCell('C3');
    periodCell.value = period.name || '';
    periodCell.font = { bold: false, size: 11 };
    periodCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Right block (Educación Media General / DEA / momento) spans only eval columns
    const rightStart = sheet.getColumn(firstEvalCol).letter;
    const lastEvalColLetter = sheet.getColumn(defCol - 1).letter;
    sheet.mergeCells(`${rightStart}1:${lastEvalColLetter}2`);
    const emgCell = sheet.getCell(`${rightStart}1`);
    emgCell.value = 'Educación Media General';
    emgCell.font = { size: 11 };
    emgCell.alignment = { horizontal: 'center', vertical: 'bottom' };

    // Row 3: Código de modalidad de estudios (same row as school period)
    sheet.mergeCells(`${rightStart}3:${lastEvalColLetter}3`);
    const deaCell = sheet.getCell(`${rightStart}3`);
    deaCell.value = studyModeCode || '';
    deaCell.font = { size: 9 };
    deaCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 4: momento/lapso (left side of row 4 stays empty)
    sheet.mergeCells(`${rightStart}4:${lastEvalColLetter}4`);
    const momentoCell = sheet.getCell(`${rightStart}4`);
    momentoCell.value = termName || '';
    momentoCell.font = { bold: true, size: 12 };
    momentoCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Left labels: Docente / Asignatura / Sección (rows 5-7, cols C-D)
    const teacherName = `${(assignment as any).teacher?.firstName || ''} ${(assignment as any).teacher?.lastName || ''}`.trim();
    const leftInfo: Array<[number, string, string, boolean]> = [
      [5, 'Docente:', teacherName || '—', false],
      [6, 'Asignatura:', subject.name, false],
      [7, 'Sección:', `${grade.name} ${section.name}`, true]
    ];
    const thinSide = { style: 'thin' as const };
    const noSide = { style: 'thin' as const, color: { argb: 'FFFFFFFF' } };
    leftInfo.forEach(([r, label, value, big]) => {
      const labelCell = sheet.getCell(`C${r}`);
      labelCell.value = label;
      labelCell.font = { bold: true, size: 9 };
      // C5-C7 already bold via font above
      labelCell.alignment = { horizontal: 'right', vertical: 'middle' };
      // C5-C6: no borders; C7: bottom border only
      labelCell.border = r === 7
        ? { top: noSide, bottom: thinSide, left: noSide, right: noSide }
        : { top: noSide, bottom: noSide, left: noSide, right: noSide };
      const valueCell = sheet.getCell(`D${r}`);
      valueCell.value = value;
      valueCell.font = big ? { bold: true, size: 12 } : { size: 9 };
      valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
      // D5-D6: right border only; D7: bottom and right border
      valueCell.border = r === 7
        ? { top: noSide, bottom: thinSide, left: noSide, right: thinSide }
        : { top: noSide, bottom: noSide, left: noSide, right: thinSide };
    });

    // Per-evaluation header block (rows 5-7): date (blue) / name (gray) / percentage
    evaluationPlans.forEach((plan: any, idx: number) => {
      const c1 = firstEvalCol + idx * 3;
      const l1 = sheet.getColumn(c1).letter;
      const l3 = sheet.getColumn(c1 + 2).letter;

      // Outer border for this evaluation block (thick left/right)
      const evalOuterBorder = {
        left: thickSide,
        right: thickSide,
        top: thinSide2,
        bottom: thinSide2
      };

      // Row 5: date (blue background, white text)
      sheet.mergeCells(`${l1}5:${l3}5`);
      const dateCell = sheet.getCell(`${l1}5`);
      dateCell.value = plan.date ? new Date(plan.date).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
      dateCell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MED_BLUE } };
      dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
      dateCell.border = { ...evalOuterBorder, top: thickSide };

      // Row 6: evaluation name (gray background)
      sheet.mergeCells(`${l1}6:${l3}6`);
      const nameCell = sheet.getCell(`${l1}6`);
      nameCell.value = plan.shortDescription || plan.description || 'Evaluación';
      nameCell.font = { bold: true, size: 9 };
      nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY } };
      nameCell.alignment = { horizontal: 'center', vertical: 'middle' };
      nameCell.border = evalOuterBorder;

      // Row 7: percentage
      sheet.mergeCells(`${l1}7:${l3}7`);
      const pctCell = sheet.getCell(`${l1}7`);
      pctCell.value = `${Number(plan.percentage)}%`;
      pctCell.font = { bold: true, size: 9 };
      pctCell.alignment = { horizontal: 'center', vertical: 'middle' };
      pctCell.border = { ...evalOuterBorder, bottom: thickSide };
    });

    // Row heights (px → ExcelJS points: px * 0.75)
    sheet.getRow(1).height = 19 * 0.75;  // 19px
    sheet.getRow(2).height = 20 * 0.75;  // 20px
    sheet.getRow(3).height = 16 * 0.75;  // 16px
    sheet.getRow(4).height = 20 * 0.75;  // 20px
    sheet.getRow(5).height = 16 * 0.75;  // 16px
    sheet.getRow(6).height = 16 * 0.75;  // 16px
    sheet.getRow(7).height = 20 * 0.75;  // 20px

    // ── Fila 8: encabezado de tabla ───────────────────────────
    sheet.getRow(8).height = 26 * 0.75;  // 26px
    const headerRow = sheet.getRow(8);
    headerRow.getCell(1).value = '#';
    headerRow.getCell(2).value = 'CÉDULA';
    sheet.mergeCells('C8:D8');
    headerRow.getCell(3).value = 'APELLIDOS Y NOMBRES';
    evaluationPlans.forEach((_plan: any, idx: number) => {
      const c1 = firstEvalCol + idx * 3;
      headerRow.getCell(c1).value = 'NOT';
      headerRow.getCell(c1 + 1).value = 'REM';
      headerRow.getCell(c1 + 2).value = '%';
    });
    headerRow.getCell(defCol).value = 'DEF';
    headerRow.getCell(obsCol).value = 'Observaciones';

    const whiteSide = { style: 'medium' as const, color: { argb: 'FFFFFFFF' } };
    const whiteThin = { style: 'thin' as const, color: { argb: 'FFFFFFFF' } };

    for (let c = 1; c <= totalCols; c++) {
      const cell = headerRow.getCell(c);
      cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BLUE } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      const isEvalFirstCol = evaluationPlans.some((_p: any, idx: number) => c === firstEvalCol + idx * 3);
      const isEvalLastCol = evaluationPlans.some((_p: any, idx: number) => c === firstEvalCol + idx * 3 + 2);
      // Outer contour stays black thick; every internal border is white, keeping its thickness
      const isOuterLeft = c === 1;
      const isOuterRight = c === obsCol;
      const isThickLeft = isEvalFirstCol || c === defCol;
      const isThickRight = isEvalLastCol || c === defCol;
      cell.border = {
        top: thickSide,
        bottom: thinSide2,
        left: isOuterLeft ? thickSide : (isThickLeft ? whiteSide : whiteThin),
        right: isOuterRight ? thickSide : (isThickRight ? whiteSide : whiteThin)
      };
    }
    headerRow.height = 22;

    // ── Filas de estudiantes (desde fila 9) ───────────────────
    const isFilled = filled !== 'false';
    const firstDataRow = 9;
    const minRows = Math.max(inscriptions.length, 35);

    const evaluationStats = evaluationPlans.map(() => ({ approved: 0, failed: 0, absent: 0 }));
    const finalStats = { approved: 0, failed: 0, absent: 0 };

    for (let i = 0; i < minRows; i++) {
      const rowNum = firstDataRow + i;
      const row = sheet.getRow(rowNum);
      const inscription: any = inscriptions[i];
      const isZebraRow = i % 2 === 1;
      const zebraFill = isZebraRow
        ? { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: ZEBRA } }
        : undefined;

      // Column #: sequential number (also for empty rows, as in the model)
      const numCell = row.getCell(1);
      numCell.value = String(i + 1).padStart(2, '0');
      numCell.font = { bold: true, size: 9 };
      numCell.alignment = { horizontal: 'center', vertical: 'middle' };
      numCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRAY } };
      numCell.border = {
        top: thinSide2,
        bottom: thinSide2,
        left: thickSide,
        right: thinSide2
      };

      const cedCell = row.getCell(2);
      sheet.mergeCells(`C${rowNum}:D${rowNum}`);
      const nameCell = row.getCell(3);
      if (inscription) {
        const doc = inscription.student?.document || '';
        cedCell.value = doc ? `V ${doc}`.trim() : '';
        nameCell.value = `${inscription.student?.lastName || ''} ${inscription.student?.firstName || ''}`.trim().toUpperCase();
      }
      cedCell.font = { size: 9 };
      cedCell.alignment = { horizontal: 'left', vertical: 'middle' };
      cedCell.border = thinBorder;
      if (zebraFill) cedCell.fill = zebraFill;
      nameCell.font = { size: 9 };
      nameCell.alignment = { horizontal: 'left', vertical: 'middle' };
      nameCell.border = thinBorder;
      if (zebraFill) nameCell.fill = zebraFill;
      row.getCell(4).border = thinBorder;
      if (zebraFill) row.getCell(4).fill = zebraFill;

      const insSub = inscription?.inscriptionSubjects?.[0];
      const studentQuals: any[] = insSub?.qualifications || [];

      let rowTotal = 0;
      evaluationPlans.forEach((plan: any, idx: number) => {
        const c1 = firstEvalCol + idx * 3;
        const notCell = row.getCell(c1);
        const remCell = row.getCell(c1 + 1);
        const pctCell = row.getCell(c1 + 2);

        if (isFilled && inscription) {
          const q = studentQuals.find((sq: any) => sq.evaluationPlanId === plan.id);
          if (q) {
            const hasRem = q.remedialScore != null && Number(q.remedialScore) > 0;
            const effectiveScore = q.isAbsent ? 0 : (hasRem ? Number(q.remedialScore) : Number(q.score));
            if (q.isAbsent) {
              notCell.value = 'NP';
              evaluationStats[idx].absent += 1;
              evaluationStats[idx].failed += 1;
            } else {
              notCell.value = Number(q.score);
              if (hasRem) remCell.value = Number(q.remedialScore);
              if (effectiveScore >= 10) evaluationStats[idx].approved += 1;
              else evaluationStats[idx].failed += 1;
            }
            const weighted = (effectiveScore * Number(plan.percentage)) / 100;
            pctCell.value = Math.round(weighted * 100) / 100;
            rowTotal += weighted;
          } else {
            pctCell.value = 0;
            evaluationStats[idx].absent += 1;
            evaluationStats[idx].failed += 1;
          }
        }

        [notCell, remCell].forEach((cell, ci) => {
          cell.font = { size: 9 };
          cell.numFmt = '00';
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          if (zebraFill) cell.fill = zebraFill;
          cell.border = {
            top: thinSide2,
            bottom: thinSide2,
            left: ci === 0 ? thickSide : thinSide2,
            right: thinSide2
          };
        });
        pctCell.font = { bold: true, size: 9 };
        pctCell.numFmt = '0.00';
        pctCell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (zebraFill) pctCell.fill = zebraFill;
        pctCell.border = {
          top: thinSide2,
          bottom: thinSide2,
          left: thinSide2,
          right: thickSide
        };
      });

      // DEF column (light green)
      const defCell = row.getCell(defCol);
      if (isFilled && inscription) {
        const finalGrade = Math.round(rowTotal);
        defCell.value = finalGrade;
        defCell.numFmt = '00';
        const hasAnyQualification = studentQuals.some((q: any) => evaluationPlans.some((plan: any) => q.evaluationPlanId === plan.id));
        const hasAbsentQualification = studentQuals.some((q: any) => evaluationPlans.some((plan: any) => q.evaluationPlanId === plan.id) && q.isAbsent);
        if (!hasAnyQualification || hasAbsentQualification) {
          finalStats.absent += 1;
          finalStats.failed += 1;
        }
        else if (finalGrade >= 10) finalStats.approved += 1;
        else finalStats.failed += 1;
      }
      defCell.font = { bold: true, size: 9 };
      defCell.alignment = { horizontal: 'center', vertical: 'middle' };
      defCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GREEN } };
      defCell.border = {
        top: thinSide2,
        bottom: thinSide2,
        left: thickSide,
        right: thickSide
      };

      // Observaciones column
      const obsCell = row.getCell(obsCol);
      if (zebraFill) obsCell.fill = zebraFill;
      obsCell.border = {
        top: thinSide2,
        bottom: thinSide2,
        left: thinSide2,
        right: thickSide
      };

      row.height = 19 * 0.75;  // 19px
    }

    const summaryTotal = inscriptions.length || 1;
    const summaryRows: Array<[number, string, 'approved' | 'failed' | 'absent']> = [
      [firstDataRow + minRows, 'Aprobados:', 'approved'],
      [firstDataRow + minRows + 1, 'Reprobados:', 'failed'],
      [firstDataRow + minRows + 2, 'Inasistentes:', 'absent']
    ];

    summaryRows.forEach(([rowNum, label, key]) => {
      const isLastSummaryRow = key === 'absent';
      const isFirstSummaryRow = key === 'approved';
      const row = sheet.getRow(rowNum);
      // Merge A:D for label, left-aligned and bold
      sheet.mergeCells(`A${rowNum}:D${rowNum}`);
      const labelCell = row.getCell(1);
      labelCell.value = label;
      labelCell.font = { bold: true, size: 9 };
      labelCell.alignment = { horizontal: 'left', vertical: 'middle' };
      labelCell.border = {
        top: isFirstSummaryRow ? thickSide : thinSide2,
        bottom: isLastSummaryRow ? thickSide : thinSide2,
        left: thickSide,
        right: thickSide
      };

      evaluationStats.forEach((stats, idx) => {
        const c1 = firstEvalCol + idx * 3;
        const count = stats[key];
        const percentage = Math.round((count * 100) / summaryTotal);
        const countCell = row.getCell(c1);
        const percentageCell = row.getCell(c1 + 2);
        countCell.value = count;
        percentageCell.value = `${percentage}%`;
        [row.getCell(c1), row.getCell(c1 + 1), percentageCell].forEach((cell, ci) => {
          cell.font = { size: 9 };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: isFirstSummaryRow ? thickSide : thinSide2,
            bottom: isLastSummaryRow ? thickSide : thinSide2,
            left: ci === 0 ? thickSide : thinSide2,
            right: ci === 2 ? thickSide : thinSide2
          };
        });
      });

      const finalCount = finalStats[key];
      const finalPercentage = Math.round((finalCount * 100) / summaryTotal);
      const finalCell = row.getCell(defCol);
      finalCell.value = `${finalPercentage}%`;
      finalCell.font = { size: 9 };
      finalCell.alignment = { horizontal: 'center', vertical: 'middle' };
      finalCell.border = {
        top: isFirstSummaryRow ? thickSide : thinSide2,
        bottom: isLastSummaryRow ? thickSide : thinSide2,
        left: thickSide,
        right: thickSide
      };
      row.getCell(obsCol).border = {
        top: isFirstSummaryRow ? thickSide : thinSide2,
        bottom: isLastSummaryRow ? thickSide : thinSide2,
        left: thinSide2,
        right: thickSide
      };
      row.height = 14 * 0.75;  // 14px
    });

    // Column widths (pixel → character width: px / 7 ≈ char width)
    sheet.getColumn(1).width = 3.3;   // A: 23px
    sheet.getColumn(2).width = 14.7;  // B: 103px
    sheet.getColumn(3).width = 9.4;   // C: 66px
    sheet.getColumn(4).width = 39.3;  // D: 275px
    for (let idx = 0; idx < nEvals; idx++) {
      const c1 = firstEvalCol + idx * 3;
      sheet.getColumn(c1).width = 6;
      sheet.getColumn(c1 + 1).width = 6;
      sheet.getColumn(c1 + 2).width = 7;
    }
    sheet.getColumn(defCol).width = 6;
    sheet.getColumn(obsCol).width = 22;

    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
    sheet.pageSetup.horizontalCentered = true;
    sheet.headerFooter.oddFooter = 'Página &P de &N';

    const buffer = await workbook.xlsx.writeBuffer();

    const fileName = isFilled
      ? `planilla-calificaciones-${subject.name.replace(/\s+/g, '_')}.xlsx`
      : `planilla-vacia-calificaciones-${subject.name.replace(/\s+/g, '_')}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error: any) {
    console.error('[exportGradesExcelOficial] Error:', error);
    res.status(500).json({ message: error.message || 'Error al exportar calificaciones' });
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

    const termId = req.query.term ? Number(req.query.term) : null;
    let termName = '';
    if (termId) {
      const term = await Term.findByPk(termId);
      termName = term ? term.getDataValue('name') : '';
    }

    const evaluationPlans = await EvaluationPlan.findAll({
      where: {
        periodGradeSubjectId: assignment.periodGradeSubjectId,
        sectionId: assignment.sectionId,
        ...(termId ? { termId } : {})
      },
      order: [['date', 'ASC']]
    });

    const [institutionName, institutionDeaCode] = await Promise.all([
      Setting.findOne({ where: { key: 'institution_name' } }),
      Setting.findOne({ where: { key: 'institution_dea_code' } })
    ]);
    const instName = institutionName?.getDataValue('value') || '';
    const deaCode = institutionDeaCode?.getDataValue('value') || '';

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

    // ── Encabezado institucional ──────────────────────────
    sheet.getCell('A1').value = 'Nombre de la Institución';
    sheet.getCell('A1').font = { bold: true, size: 10 };
    sheet.getCell('A1').alignment = { vertical: 'middle' };
    sheet.mergeCells(`B1:${lastCol}1`);
    const instCell = sheet.getCell('B1');
    instCell.value = instName || 'Sin nombre configurado';
    instCell.font = { bold: true, size: 14 };
    instCell.alignment = { vertical: 'middle' };

    sheet.getCell('A2').value = 'Período Escolar';
    sheet.getCell('A2').font = { bold: true, size: 10 };
    sheet.getCell('A2').alignment = { vertical: 'middle' };
    sheet.mergeCells(`B2:${lastCol}2`);
    const periodCell = sheet.getCell('B2');
    periodCell.value = period.name || '';
    periodCell.font = { size: 11 };
    periodCell.alignment = { vertical: 'middle' };

    // Logo institucional (columna A, junto a docente/asignatura/sección)
    try {
      const uploadDir = path.join(__dirname, '../../public/uploads/images');
      const logoFile = fs.existsSync(path.join(uploadDir, 'institution_logo.png'))
        ? 'institution_logo.png'
        : fs.readdirSync(uploadDir).find((f: string) => f.startsWith('institution_logo'));
      if (logoFile) {
        const ext = logoFile.split('.').pop()?.toLowerCase() as 'jpeg' | 'png' | 'gif' | undefined;
        if (ext) {
          const imageId = workbook.addImage({ filename: path.join(uploadDir, logoFile), extension: ext });
          sheet.addImage(imageId, { tl: { col: 0, row: 2 }, ext: { width: 90, height: 90 } });
        }
      }
    } catch { /* logo opcional */ }

    const teacherName = `${(assignment as any).teacher?.firstName || ''} ${(assignment as any).teacher?.lastName || ''}`.trim();
    sheet.mergeCells(`B3:${lastCol}3`);
    sheet.getCell('B3').value = `Docente: ${teacherName || '—'}`;
    sheet.getCell('B3').font = { size: 11 };
    sheet.mergeCells(`B4:${lastCol}4`);
    sheet.getCell('B4').value = `Asignatura: ${subject.name}`;
    sheet.getCell('B4').font = { size: 11 };
    sheet.mergeCells(`B5:${lastCol}5`);
    sheet.getCell('B5').value = `Sección: ${section.name}   |   Grado: ${grade.name}`;
    sheet.getCell('B5').font = { size: 11 };
    sheet.mergeCells(`B6:${lastCol}6`);
    sheet.getCell('B6').value = `Código DEA: ${deaCode || '—'}   |   Lapso: ${termName || '—'}`;
    sheet.getCell('B6').font = { size: 11 };

    sheet.getColumn(1).width = 24;
    for (let r = 1; r <= 6; r++) {
      sheet.getRow(r).height = 20;
    }

    sheet.getRow(7).values = [];

    // Header row 1 (row 8): text labels + evaluation IDs
    const headerRow1 = sheet.getRow(8);
    headerRow1.getCell(1).value = 'Cédula';
    headerRow1.getCell(2).value = 'Apellidos';
    headerRow1.getCell(3).value = 'Nombres';

    let col = 4;
    evaluationPlans.forEach((plan: any) => {
      headerRow1.getCell(col).value = plan.description;
      col++;
    });
    headerRow1.getCell(col).value = 'Total';

    // Merge name columns across rows 8-9
    sheet.mergeCells('A8:A9');
    sheet.mergeCells('B8:B9');
    sheet.mergeCells('C8:C9');
    // Merge Total column across rows 8-9
    const totalCol = sheet.getColumn(col).letter;
    sheet.mergeCells(`${totalCol}8:${totalCol}9`);

    // Header row 2 (row 9): percentages
    const headerRow2 = sheet.getRow(9);
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
    let rowNum = 10;
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
          if (!q.isAbsent) {
            const effectiveScore = q.remedialScore != null && Number(q.remedialScore) > 0 ? Number(q.remedialScore) : Number(q.score);
            rowTotal += (effectiveScore * Number(plan.percentage)) / 100;
          }
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
    sheet.getColumn(1).width = 24;
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

export const getAllAssignments = async (req: Request, res: Response) => {
  try {
    const user = (req.session as any).user;
    if (!user) return res.status(401).json({ message: 'No autorizado' });

    const assignments = await TeacherAssignment.findAll({
      include: [
        {
          model: PeriodGradeSubject,
          as: 'periodGradeSubject',
          required: true,
          include: [
            { model: Subject, as: 'subject' },
            {
              model: PeriodGrade,
              as: 'periodGrade',
              required: true,
              include: [
                { model: Grade, as: 'grade' },
                {
                  model: SchoolPeriod,
                  as: 'schoolPeriod',
                  required: true,
                  where: { status: 'activo' }
                }
              ]
            }
          ]
        },
        { model: Section, as: 'section' },
        { model: Person, as: 'teacher' }
      ],
      order: [
        [{ model: PeriodGradeSubject, as: 'periodGradeSubject' },
         { model: PeriodGrade, as: 'periodGrade' },
         { model: Grade, as: 'grade' }, 'id', 'ASC'],
        [{ model: Section, as: 'section' }, 'name', 'ASC'],
        [{ model: PeriodGradeSubject, as: 'periodGradeSubject' }, 'order', 'ASC']
      ]
    });

    res.json(assignments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener asignaciones' });
  }
};

export const getQualificationAudits = async (req: Request, res: Response) => {
  try {
    const { assignmentId } = req.params;

    const assignment = await TeacherAssignment.findByPk(Number(assignmentId), {
      include: [{
        model: PeriodGradeSubject,
        as: 'periodGradeSubject',
        include: [{ model: Subject, as: 'subject' }]
      }]
    });

    if (!assignment) return res.status(404).json({ message: 'Asignación no encontrada' });

    const plans = await EvaluationPlan.findAll({
      where: {
        periodGradeSubjectId: assignment.periodGradeSubjectId,
        sectionId: assignment.sectionId
      },
      attributes: ['id']
    });

    const planIds = plans.map(p => p.id);
    if (planIds.length === 0) return res.json([]);

    const audits = await QualificationAudit.findAll({
      include: [
        {
          model: Qualification,
          as: 'qualification',
          where: { evaluationPlanId: { [Op.in]: planIds } },
          required: true,
          include: [
            { model: EvaluationPlan, as: 'evaluationPlan', attributes: ['id', 'description', 'percentage'] },
            {
              model: InscriptionSubject,
              as: 'inscriptionSubject',
              include: [
                { model: Subject, as: 'subject', attributes: ['id', 'name'] },
                {
                  model: Inscription,
                  as: 'inscription',
                  attributes: ['id'],
                  include: [
                    { model: Person, as: 'student', attributes: ['id', 'firstName', 'lastName', 'document'] }
                  ]
                }
              ]
            }
          ]
        },
        { model: User, as: 'editor', attributes: ['id', 'username'],
          include: [{ model: Person, as: 'person', attributes: ['id', 'firstName', 'lastName'] }]
        }
      ],
      order: [['editedAt', 'DESC']],
      limit: 200
    });

    res.json(audits);
  } catch (error: any) {
    console.error('[getQualificationAudits] Error:', error);
    res.status(500).json({ message: 'Error al obtener auditoría' });
  }
};

export const getAllQualificationAudits = async (_req: Request, res: Response) => {
  try {
    const audits = await QualificationAudit.findAll({
      include: [
        {
          model: Qualification,
          as: 'qualification',
          required: true,
          include: [
            {
              model: EvaluationPlan,
              as: 'evaluationPlan',
              attributes: ['id', 'description', 'percentage'],
            },
            {
              model: InscriptionSubject,
              as: 'inscriptionSubject',
              include: [
                { model: Subject, as: 'subject', attributes: ['id', 'name'] },
                {
                  model: Inscription,
                  as: 'inscription',
                  attributes: ['id', 'schoolPeriodId', 'gradeId'],
                  include: [
                    { model: Person, as: 'student', attributes: ['id', 'firstName', 'lastName', 'document'] },
                    { model: Grade, as: 'grade', attributes: ['id', 'name'] },
                    { model: SchoolPeriod, as: 'period', attributes: ['id', 'name'] },
                  ]
                }
              ]
            }
          ]
        },
        { model: User, as: 'editor', attributes: ['id', 'username'],
          include: [{ model: Person, as: 'person', attributes: ['id', 'firstName', 'lastName'] }]
        }
      ],
      order: [['editedAt', 'DESC']],
      limit: 200
    });

    res.json(audits);
  } catch (error: any) {
    console.error('[getAllQualificationAudits] Error:', error);
    res.status(500).json({ message: 'Error al obtener auditoría' });
  }
};
