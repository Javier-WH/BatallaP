import { Request, Response } from 'express';
import { Op } from 'sequelize';
import sequelize from '@/config/database';
import {
  SchoolPeriod,
  Grade,
  Section,
  Subject,
  PeriodGrade,
  PeriodGradeSection,
  PeriodGradeSubject,
  Inscription,
  InscriptionSubject,
  Person,
  TeacherAssignment,
  SubjectFinalGrade,
  EvaluationPlan,
  Qualification,
  Term,
  PendingSubject,
  PendingSubjectEncounter,
  PendingSubjectContent,
  PendingSubjectContentItem,
  Setting,
} from '@/models/index';
import { sortInscriptions } from '@/services/studentSortService';
import { getSubjectOrderMap } from '@/services/subjectOrderService';
import { roundFinalGrade, MIN_FINAL_GRADE, resolveGradeStatus } from '@/services/gradeEvaluationService';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const MP_SECTION_NAME = 'Materia Pendiente';

/** Find or create the "Materia Pendiente" section. */
async function findOrCreateMpSection(t?: any): Promise<Section> {
  const [section] = await Section.findOrCreate({
    where: { name: MP_SECTION_NAME },
    defaults: { name: MP_SECTION_NAME },
    transaction: t,
  });
  return section;
}

/** Find or create the PeriodGrade for a grade in the active period. */
async function findOrCreateMpPeriodGrade(schoolPeriodId: number, gradeId: number, t?: any): Promise<PeriodGrade> {
  const [pg] = await PeriodGrade.findOrCreate({
    where: { schoolPeriodId, gradeId },
    defaults: { schoolPeriodId, gradeId },
    transaction: t,
  });
  return pg;
}

/** Link the MP section to a PeriodGrade. */
async function linkMpSection(pgId: number, sectionId: number, t?: any): Promise<void> {
  await PeriodGradeSection.findOrCreate({
    where: { periodGradeId: pgId, sectionId },
    defaults: { periodGradeId: pgId, sectionId },
    transaction: t,
  });
}

/* ------------------------------------------------------------------ */
/* GET /pending-subjects/structure                                     */
/* ------------------------------------------------------------------ */
export const getMpStructure = async (req: Request, res: Response) => {
  try {
    const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });
    if (!activePeriod) {
      return res.json({ period: null, grades: [] });
    }

    // Get all grades ordered by `order`
    const allGrades = await Grade.findAll({ order: [['order', 'ASC'], ['name', 'ASC']] });

    // Exclude the last grade (highest order) — MP only goes up to penultimate
    if (allGrades.length <= 1) {
      return res.json({ period: activePeriod, grades: [] });
    }
    const mpGrades = allGrades.slice(0, -1);

    // Get the PeriodGrade for each grade in the active period
    const result = [];
    for (const grade of mpGrades) {
      const pg = await PeriodGrade.findOne({
        where: { schoolPeriodId: activePeriod.id, gradeId: grade.id },
        include: [
          {
            model: Subject,
            as: 'subjects',
            through: { attributes: ['id', 'order', 'active', 'includeInAverage'], where: { active: true } },
          },
        ],
      });

      if (!pg) {
        result.push({
          grade,
          periodGrade: null,
          subjects: [],
          mpSection: null,
        });
        continue;
      }

      // Ensure MP section exists and is linked
      const mpSection = await findOrCreateMpSection();
      await linkMpSection(pg.id, mpSection.id);

      // Get subjects in canonical order
      const subjectOrderMap = await getSubjectOrderMap(pg.id);
      const subjects = (pg as any).subjects || [];
      const sortedSubjects = subjects.sort((a: any, b: any) => {
        const oa = subjectOrderMap.get(a.id) ?? 99;
        const ob = subjectOrderMap.get(b.id) ?? 99;
        return oa - ob;
      });

      // For each subject, count how many students are registered
      const subjectsWithCount = [];
      for (const subj of sortedSubjects) {
        // Find MP inscriptions for this grade in the active period
        const mpInscriptions = await Inscription.findAll({
          where: {
            schoolPeriodId: activePeriod.id,
            gradeId: grade.id,
            sectionId: mpSection.id,
          },
          include: [
            {
              model: InscriptionSubject,
              as: 'inscriptionSubjects',
              where: { subjectId: subj.id },
              required: true,
            },
          ],
        });
        subjectsWithCount.push({
          ...subj.toJSON(),
          studentCount: mpInscriptions.length,
          periodGradeSubjectId: (subj as any).PeriodGradeSubject?.id,
        });
      }

      result.push({
        grade,
        periodGrade: pg,
        subjects: subjectsWithCount,
        mpSection,
      });
    }

    return res.json({ period: activePeriod, grades: result });
  } catch (error) {
    console.error('[getMpStructure] Error:', error);
    return res.status(500).json({ message: 'Error al obtener estructura de materia pendiente' });
  }
};

/* ------------------------------------------------------------------ */
/* GET /pending-subjects/students/:gradeId                             */
/* List students from the NEXT grade (year+1) for registration        */
/* ------------------------------------------------------------------ */
export const getStudentsForMpRegistration = async (req: Request, res: Response) => {
  try {
    const { gradeId } = req.params;
    const gradeIdNum = Number(gradeId);
    if (!Number.isFinite(gradeIdNum)) {
      return res.status(400).json({ message: 'gradeId inválido' });
    }

    const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });
    if (!activePeriod) {
      return res.json({ students: [] });
    }

    // Find the next grade (order + 1)
    const currentGrade = await Grade.findByPk(gradeIdNum);
    if (!currentGrade) {
      return res.status(404).json({ message: 'Grado no encontrado' });
    }

    const allGrades = await Grade.findAll({ order: [['order', 'ASC'], ['name', 'ASC']] });
    const currentIdx = allGrades.findIndex(g => g.id === gradeIdNum);
    if (currentIdx === -1 || currentIdx >= allGrades.length - 1) {
      return res.json({ students: [] });
    }
    const nextGrade = allGrades[currentIdx + 1];

    // Get all inscriptions for the next grade in the active period (all sections, excluding MP section)
    const mpSection = await Section.findOne({ where: { name: MP_SECTION_NAME } });
    const whereClause: any = {
      schoolPeriodId: activePeriod.id,
      gradeId: nextGrade.id,
    };
    if (mpSection) {
      whereClause.sectionId = { [Op.ne]: mpSection.id };
    }

    const inscriptions = await Inscription.findAll({
      where: whereClause,
      include: [
        { model: Person, as: 'student' },
        { model: Section, as: 'section' },
      ],
    });

    // Sort canonically, but put materia_pendiente students first
    const mpStudents = inscriptions.filter(i => (i as any).escolaridad === 'materia_pendiente');
    const otherStudents = inscriptions.filter(i => (i as any).escolaridad !== 'materia_pendiente');

    sortInscriptions(mpStudents as any[]);
    sortInscriptions(otherStudents as any[]);

    const students = [...mpStudents, ...otherStudents].map((ins: any) => ({
      inscriptionId: ins.id,
      personId: ins.personId,
      studentName: `${ins.student?.lastName} ${ins.student?.firstName}`,
      studentDni: ins.student?.document,
      documentType: ins.student?.documentType,
      escolaridad: ins.escolaridad,
      sectionName: ins.section?.name,
      gradeName: nextGrade.name,
    }));

    return res.json({ students, nextGrade });
  } catch (error) {
    console.error('[getStudentsForMpRegistration] Error:', error);
    return res.status(500).json({ message: 'Error al obtener estudiantes' });
  }
};

/* ------------------------------------------------------------------ */
/* POST /pending-subjects/register                                     */
/* Register students in a pending subject (creates MP inscription)     */
/* ------------------------------------------------------------------ */
export const registerStudentsInMp = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const { gradeId, subjectId, inscriptionIds } = req.body as {
      gradeId: number;
      subjectId: number;
      inscriptionIds: number[];
    };

    if (!Number.isFinite(gradeId) || !Number.isFinite(subjectId) || !Array.isArray(inscriptionIds)) {
      return res.status(400).json({ message: 'gradeId, subjectId e inscriptionIds son requeridos' });
    }

    const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });
    if (!activePeriod) {
      return res.status(400).json({ message: 'No hay un período activo' });
    }

    // Ensure MP section and PeriodGrade exist
    const mpSection = await findOrCreateMpSection(t);
    const mpPeriodGrade = await findOrCreateMpPeriodGrade(activePeriod.id, gradeId, t);
    await linkMpSection(mpPeriodGrade.id, mpSection.id, t);

    // Ensure PeriodGradeSubject exists for this subject in the MP PeriodGrade
    let pgs = await PeriodGradeSubject.findOne({
      where: { periodGradeId: mpPeriodGrade.id, subjectId },
      transaction: t,
    });
    if (!pgs) {
      pgs = await PeriodGradeSubject.create({
        periodGradeId: mpPeriodGrade.id,
        subjectId,
        active: true,
        includeInAverage: false,
      }, { transaction: t });
    }

    let registered = 0;
    for (const sourceInscriptionId of inscriptionIds) {
      const sourceInscription = await Inscription.findByPk(sourceInscriptionId, { transaction: t });
      if (!sourceInscription) continue;

      // Find or create the MP inscription for this student (same grade, MP section, active period)
      let mpInscription = await Inscription.findOne({
        where: {
          schoolPeriodId: activePeriod.id,
          gradeId,
          sectionId: mpSection.id,
          personId: sourceInscription.personId,
        },
        transaction: t,
      });

      if (!mpInscription) {
        mpInscription = await Inscription.create({
          schoolPeriodId: activePeriod.id,
          gradeId,
          sectionId: mpSection.id,
          personId: sourceInscription.personId,
          escolaridad: 'materia_pendiente',
          originPeriodId: sourceInscription.originPeriodId || sourceInscription.schoolPeriodId,
          isRepeater: false,
        }, { transaction: t });
      }

      // Create InscriptionSubject if not exists
      const existingInsSubj = await InscriptionSubject.findOne({
        where: { inscriptionId: mpInscription.id, subjectId },
        transaction: t,
      });
      if (!existingInsSubj) {
        await InscriptionSubject.create({
          inscriptionId: mpInscription.id,
          subjectId,
        }, { transaction: t });
      }

      // Create PendingSubject record if not exists
      const existingPending = await PendingSubject.findOne({
        where: { newInscriptionId: mpInscription.id, subjectId },
        transaction: t,
      });
      if (!existingPending) {
        await PendingSubject.create({
          newInscriptionId: mpInscription.id,
          subjectId,
          originPeriodId: sourceInscription.schoolPeriodId,
          status: 'pendiente',
        }, { transaction: t });
      }

      // Change escolaridad of the SOURCE inscription to materia_pendiente
      if (sourceInscription.escolaridad !== 'materia_pendiente') {
        await sourceInscription.update({ escolaridad: 'materia_pendiente' }, { transaction: t });
      }

      registered++;
    }

    await t.commit();
    return res.json({ message: `${registered} estudiante(s) registrado(s) en materia pendiente`, registered });
  } catch (error) {
    await t.rollback();
    console.error('[registerStudentsInMp] Error:', error);
    return res.status(500).json({ message: 'Error al registrar estudiantes en materia pendiente' });
  }
};

/* ------------------------------------------------------------------ */
/* DELETE /pending-subjects/remove/:inscriptionSubjectId               */
/* Remove a student from a pending subject                             */
/* ------------------------------------------------------------------ */
export const removeStudentFromMp = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const inscriptionSubjectId = Number(req.params.inscriptionSubjectId);
    if (!Number.isFinite(inscriptionSubjectId)) {
      return res.status(400).json({ message: 'inscriptionSubjectId inválido' });
    }

    const insSubj = await InscriptionSubject.findByPk(inscriptionSubjectId, { transaction: t });
    if (!insSubj) {
      return res.status(404).json({ message: 'Registro no encontrado' });
    }

    // Delete PendingSubject record
    await PendingSubject.destroy({
      where: { newInscriptionId: insSubj.inscriptionId, subjectId: insSubj.subjectId },
      transaction: t,
    });

    // Delete SubjectFinalGrade if exists
    await SubjectFinalGrade.destroy({
      where: { inscriptionSubjectId: insSubj.id },
      transaction: t,
    });

    // Delete the InscriptionSubject
    await insSubj.destroy({ transaction: t });

    // Check if the MP inscription has no more subjects → delete it
    const remaining = await InscriptionSubject.count({
      where: { inscriptionId: insSubj.inscriptionId },
      transaction: t,
    });
    if (remaining === 0) {
      await Inscription.destroy({
        where: { id: insSubj.inscriptionId },
        transaction: t,
      });
    }

    await t.commit();
    return res.json({ message: 'Estudiante removido de la materia pendiente' });
  } catch (error) {
    await t.rollback();
    console.error('[removeStudentFromMp] Error:', error);
    return res.status(500).json({ message: 'Error al remover estudiante' });
  }
};

/* ------------------------------------------------------------------ */
/* GET /pending-subjects/nomina/:gradeId                               */
/* Nómina estilo reparación: students × subjects matrix               */
/* ------------------------------------------------------------------ */
export const getMpNomina = async (req: Request, res: Response) => {
  try {
    const { gradeId } = req.params;
    const gradeIdNum = Number(gradeId);
    if (!Number.isFinite(gradeIdNum)) {
      return res.status(400).json({ message: 'gradeId inválido' });
    }

    const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });
    if (!activePeriod) {
      return res.json({ grade: null, subjects: [], students: [] });
    }

    const mpSection = await Section.findOne({ where: { name: MP_SECTION_NAME } });
    if (!mpSection) {
      return res.json({ grade: null, subjects: [], students: [] });
    }

    // Get the PeriodGrade for this grade
    const pg = await PeriodGrade.findOne({
      where: { schoolPeriodId: activePeriod.id, gradeId: gradeIdNum },
    });
    if (!pg) {
      return res.json({ grade: null, subjects: [], students: [] });
    }

    // Get subjects in canonical order
    const subjectOrderMap = await getSubjectOrderMap(pg.id);
    const pgsList = await PeriodGradeSubject.findAll({
      where: { periodGradeId: pg.id, active: true },
      include: [{ model: Subject, as: 'subject' }],
      transaction: undefined,
    });
    const subjects = pgsList
      .sort((a, b) => (subjectOrderMap.get(a.subjectId) ?? 99) - (subjectOrderMap.get(b.subjectId) ?? 99))
      .map(pgs => ({
        id: pgs.subjectId,
        name: (pgs as any).subject?.name,
        periodGradeSubjectId: pgs.id,
      }));

    // Get all MP inscriptions for this grade
    const inscriptions = await Inscription.findAll({
      where: {
        schoolPeriodId: activePeriod.id,
        gradeId: gradeIdNum,
        sectionId: mpSection.id,
      },
      include: [
        { model: Person, as: 'student' },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          include: [
            { model: Subject, as: 'subject' },
            { model: SubjectFinalGrade, as: 'finalGrade' },
          ],
        },
      ],
    });

    sortInscriptions(inscriptions as any[]);

    const students = inscriptions.map((ins: any) => ({
      inscriptionId: ins.id,
      personId: ins.personId,
      studentName: `${ins.student?.lastName} ${ins.student?.firstName}`,
      studentDni: ins.student?.document,
      documentType: ins.student?.documentType,
      subjects: ins.inscriptionSubjects?.map((is: any) => ({
        inscriptionSubjectId: is.id,
        subjectId: is.subjectId,
        subjectName: is.subject?.name,
        finalGrade: is.finalGrade ? {
          finalScore: is.finalGrade.finalScore,
          status: is.finalGrade.status,
          gradeType: is.finalGrade.gradeType,
          calculatedAt: is.finalGrade.calculatedAt,
        } : null,
      })) || [],
    }));

    const grade = await Grade.findByPk(gradeIdNum);

    return res.json({ grade, subjects, students });
  } catch (error) {
    console.error('[getMpNomina] Error:', error);
    return res.status(500).json({ message: 'Error al obtener nómina de materia pendiente' });
  }
};

/* ------------------------------------------------------------------ */
/* GET /pending-subjects/teacher-assignments                           */
/* Get MP assignments for the logged-in teacher                        */
/* ------------------------------------------------------------------ */
export const getMpTeacherAssignments = async (req: Request, res: Response) => {
  try {
    const personId = (req.session as any)?.user?.personId;
    if (!personId) {
      return res.status(403).json({ message: 'No autorizado' });
    }

    const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });
    if (!activePeriod) {
      return res.json({ assignments: [] });
    }

    const mpSection = await Section.findOne({ where: { name: MP_SECTION_NAME } });
    if (!mpSection) {
      return res.json({ assignments: [] });
    }

    // Find TeacherAssignments where sectionId = MP section
    const assignments = await TeacherAssignment.findAll({
      where: {
        teacherId: personId,
        sectionId: mpSection.id,
      },
      include: [
        {
          model: PeriodGradeSubject,
          as: 'periodGradeSubject',
          include: [
            { model: Subject, as: 'subject' },
            { model: PeriodGrade, as: 'periodGrade', where: { schoolPeriodId: activePeriod.id } },
          ],
        },
      ],
    });

    const result = assignments.map((a: any) => ({
      id: a.id,
      periodGradeSubjectId: a.periodGradeSubjectId,
      subjectId: a.periodGradeSubject?.subjectId,
      subjectName: a.periodGradeSubject?.subject?.name,
      gradeId: a.periodGradeSubject?.periodGrade?.gradeId,
    }));

    return res.json({ assignments: result });
  } catch (error) {
    console.error('[getMpTeacherAssignments] Error:', error);
    return res.status(500).json({ message: 'Error al obtener asignaciones' });
  }
};

/* ------------------------------------------------------------------ */
/* GET /pending-subjects/assignment/:periodGradeSubjectId              */
/* Get students + grades for a specific MP assignment                  */
/* ------------------------------------------------------------------ */
export const getMpAssignmentDetail = async (req: Request, res: Response) => {
  try {
    const pgsId = Number(req.params.periodGradeSubjectId);
    if (!Number.isFinite(pgsId)) {
      return res.status(400).json({ message: 'periodGradeSubjectId inválido' });
    }

    const pgs = await PeriodGradeSubject.findByPk(pgsId, {
      include: [
        { model: Subject, as: 'subject' },
        { model: PeriodGrade, as: 'periodGrade' },
      ],
    });
    if (!pgs) {
      return res.status(404).json({ message: 'Asignación no encontrada' });
    }

    const mpSection = await Section.findOne({ where: { name: MP_SECTION_NAME } });
    if (!mpSection) {
      return res.json({ ...pgs.toJSON(), students: [] });
    }

    // Get MP inscriptions for this grade
    const inscriptions = await Inscription.findAll({
      where: {
        schoolPeriodId: (pgs as any).periodGrade.schoolPeriodId,
        gradeId: (pgs as any).periodGrade.gradeId,
        sectionId: mpSection.id,
      },
      include: [
        { model: Person, as: 'student' },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          where: { subjectId: pgs.subjectId },
          required: true,
          include: [
            { model: SubjectFinalGrade, as: 'finalGrade' },
            {
              model: Qualification,
              as: 'qualifications',
              include: [{ model: EvaluationPlan, as: 'evaluationPlan' }],
            },
          ],
        },
      ],
    });

    sortInscriptions(inscriptions as any[]);

    const students = inscriptions.map((ins: any) => {
      const insSubj = ins.inscriptionSubjects?.[0];
      return {
        inscriptionId: ins.id,
        inscriptionSubjectId: insSubj?.id,
        personId: ins.personId,
        studentName: `${ins.student?.lastName} ${ins.student?.firstName}`,
        studentDni: ins.student?.document,
        documentType: ins.student?.documentType,
        finalGrade: insSubj?.finalGrade ? {
          finalScore: insSubj.finalGrade.finalScore,
          status: insSubj.finalGrade.status,
          gradeType: insSubj.finalGrade.gradeType,
          calculatedAt: insSubj.finalGrade.calculatedAt,
        } : null,
        qualifications: insSubj?.qualifications?.map((q: any) => ({
          id: q.id,
          score: q.score,
          remedialScore: q.remedialScore,
          isAbsent: q.isAbsent,
          evaluationPlanId: q.evaluationPlanId,
          percentage: q.evaluationPlan?.percentage,
          termId: q.evaluationPlan?.termId,
          description: q.evaluationPlan?.description,
        })) || [],
      };
    });

    // Get evaluation plans for this PGS+section
    const evaluationPlans = await EvaluationPlan.findAll({
      where: { periodGradeSubjectId: pgsId, sectionId: mpSection.id },
      include: [{ model: Term, as: 'term' }],
      order: [['termId', 'ASC'], ['date', 'ASC']],
    });

    // Get active period terms
    const terms = await Term.findAll({
      where: { schoolPeriodId: (pgs as any).periodGrade.schoolPeriodId },
      order: [['order', 'ASC']],
    });

    return res.json({
      periodGradeSubject: pgs,
      subjectName: (pgs as any).subject?.name,
      students,
      evaluationPlans,
      terms,
    });
  } catch (error) {
    console.error('[getMpAssignmentDetail] Error:', error);
    return res.status(500).json({ message: 'Error al obtener detalle de la asignación' });
  }
};

/* ---------------------------------------------------------------------- */
/* GET /pending-subjects/assignment/:periodGradeSubjectId/encounters       */
/* Get students with their pendingSubjectId + encounters for this PGS.    */
/* Used by the teacher panel to render the encounter-based grading grid.  */
/* ---------------------------------------------------------------------- */
export const getMpAssignmentEncounters = async (req: Request, res: Response) => {
  try {
    const pgsId = Number(req.params.periodGradeSubjectId);
    if (!Number.isFinite(pgsId)) {
      return res.status(400).json({ message: 'periodGradeSubjectId inválido' });
    }

    const pgs = await PeriodGradeSubject.findByPk(pgsId, {
      include: [{ model: Subject, as: 'subject' }, { model: PeriodGrade, as: 'periodGrade' }],
    });
    if (!pgs) {
      return res.status(404).json({ message: 'Asignación no encontrada' });
    }

    const mpSection = await Section.findOne({ where: { name: MP_SECTION_NAME } });
    if (!mpSection) {
      return res.json({ subjectName: (pgs as any).subject?.name, maxEncounters: 4, students: [] });
    }

    const maxEnc = await getMaxEncounters();

    // Get MP inscriptions with pending subjects + encounters
    const inscriptions = await Inscription.findAll({
      where: {
        schoolPeriodId: (pgs as any).periodGrade.schoolPeriodId,
        gradeId: (pgs as any).periodGrade.gradeId,
        sectionId: mpSection.id,
      },
      include: [
        { model: Person, as: 'student' },
        {
          model: PendingSubject,
          as: 'pendingSubjects',
          where: { subjectId: pgs.subjectId },
          required: true,
          include: [{
            model: PendingSubjectEncounter,
            as: 'encounters',
            order: [['encounterNumber', 'ASC']],
          }],
        },
      ],
    });

    sortInscriptions(inscriptions as any[]);

    // Ensure each pending subject has N encounters
    for (const ins of inscriptions as any[]) {
      for (const ps of ins.pendingSubjects || []) {
        await ensureEncounters(ps.id, maxEnc);
        // Reload encounters
        ps.encounters = await PendingSubjectEncounter.findAll({
          where: { pendingSubjectId: ps.id },
          order: [['encounterNumber', 'ASC']],
        });
      }
    }

    const students = inscriptions.map((ins: any) => {
      const ps = ins.pendingSubjects?.[0];
      return {
        inscriptionId: ins.id,
        pendingSubjectId: ps?.id ?? null,
        personId: ins.personId,
        studentName: `${ins.student?.lastName} ${ins.student?.firstName}`,
        studentDni: ins.student?.document,
        documentType: ins.student?.documentType,
        status: ps?.status ?? 'pendiente',
        encounters: (ps?.encounters || []).map((e: any) => ({
          id: e.id,
          encounterNumber: e.encounterNumber,
          date: e.date,
          score: e.score,
          isAbsent: e.isAbsent,
        })),
      };
    });

    return res.json({
      subjectName: (pgs as any).subject?.name,
      maxEncounters: maxEnc,
      students,
    });
  } catch (error) {
    console.error('[getMpAssignmentEncounters] Error:', error);
    return res.status(500).json({ message: 'Error al obtener encuentros de la asignación' });
  }
};

/* ------------------------------------------------------------------ */
/* POST /pending-subjects/final-grade                                  */
/* Save a direct final grade for a pending subject                     */
/* ------------------------------------------------------------------ */
export const saveMpFinalGrade = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const { inscriptionSubjectId, finalScore, date } = req.body as {
      inscriptionSubjectId: number;
      finalScore: number;
      date?: string;
    };

    if (!Number.isFinite(inscriptionSubjectId) || !Number.isFinite(finalScore)) {
      return res.status(400).json({ message: 'inscriptionSubjectId y finalScore son requeridos' });
    }

    const insSubj = await InscriptionSubject.findByPk(inscriptionSubjectId, { transaction: t });
    if (!insSubj) {
      return res.status(404).json({ message: 'InscriptionSubject no encontrado' });
    }

    const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });
    const roundedScore = roundFinalGrade(finalScore);
    // Score 0 is treated as NP (inasistente), same logic as regular grades
    const isAbsent = roundedScore === 0;
    const status = isAbsent ? 'reprobada' : resolveGradeStatus(roundedScore, 10);
    // Use provided date (local noon to avoid TZ offset) or now
    const calculatedDate = date ? new Date(`${date}T12:00:00`) : new Date();

    // Upsert SubjectFinalGrade with gradeType='materia_pendiente'
    await SubjectFinalGrade.upsert({
      inscriptionSubjectId,
      finalScore: isAbsent ? 0 : roundedScore,
      rawScore: finalScore,
      status,
      calculatedAt: calculatedDate,
      gradeType: 'materia_pendiente',
    }, { transaction: t });

    // Update PendingSubject status
    const pending = await PendingSubject.findOne({
      where: { newInscriptionId: insSubj.inscriptionId, subjectId: insSubj.subjectId },
      transaction: t,
    });
    if (pending) {
      await pending.update({
        status: status === 'aprobada' ? 'aprobada' : 'pendiente',
        resolvedAt: status === 'aprobada' ? calculatedDate : null,
      }, { transaction: t });
    }

    await t.commit();
    return res.json({
      message: 'Nota guardada correctamente',
      finalScore: isAbsent ? 0 : roundedScore,
      status,
      isAbsent,
      period: activePeriod?.name,
    });
  } catch (error) {
    await t.rollback();
    console.error('[saveMpFinalGrade] Error:', error);
    return res.status(500).json({ message: 'Error al guardar la nota' });
  }
};

/* ------------------------------------------------------------------ */
/* POST /pending-subjects/evaluation-plan                              */
/* Create an evaluation plan item for an MP assignment                 */
/* ------------------------------------------------------------------ */
export const createMpEvaluationItem = async (req: Request, res: Response) => {
  try {
    const { periodGradeSubjectId, sectionId, termId, description, percentage, date } = req.body;

    if (!Number.isFinite(periodGradeSubjectId) || !Number.isFinite(sectionId) || !Number.isFinite(termId)) {
      return res.status(400).json({ message: 'periodGradeSubjectId, sectionId y termId son requeridos' });
    }

    const item = await EvaluationPlan.create({
      periodGradeSubjectId,
      sectionId,
      termId,
      description: description || 'Evaluación',
      percentage: percentage || 100,
      date: date ? new Date(date + 'T00:00:00') : new Date(),
    });

    return res.status(201).json(item);
  } catch (error) {
    console.error('[createMpEvaluationItem] Error:', error);
    return res.status(500).json({ message: 'Error al crear item de evaluación' });
  }
};

/* ------------------------------------------------------------------ */
/* PUT /pending-subjects/evaluation-plan/:id                           */
/* Update an evaluation plan item                                      */
/* ------------------------------------------------------------------ */
export const updateMpEvaluationItem = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: 'id inválido' });
    }
    const { description, percentage, termId, date } = req.body;
    const item = await EvaluationPlan.findByPk(id);
    if (!item) {
      return res.status(404).json({ message: 'Item no encontrado' });
    }
    await item.update({
      ...(description !== undefined && { description }),
      ...(percentage !== undefined && { percentage }),
      ...(termId !== undefined && { termId }),
      ...(date !== undefined && { date: new Date(date + 'T00:00:00') }),
    });
    return res.json(item);
  } catch (error) {
    console.error('[updateMpEvaluationItem] Error:', error);
    return res.status(500).json({ message: 'Error al actualizar item' });
  }
};

/* ------------------------------------------------------------------ */
/* DELETE /pending-subjects/evaluation-plan/:id                        */
/* Delete an evaluation plan item and its qualifications               */
/* ------------------------------------------------------------------ */
export const deleteMpEvaluationItem = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ message: 'id inválido' });
    }
    const item = await EvaluationPlan.findByPk(id, { transaction: t });
    if (!item) {
      return res.status(404).json({ message: 'Item no encontrado' });
    }
    // Delete associated qualifications first
    await Qualification.destroy({ where: { evaluationPlanId: id }, transaction: t });
    await item.destroy({ transaction: t });
    await t.commit();
    return res.json({ message: 'Item eliminado' });
  } catch (error) {
    await t.rollback();
    console.error('[deleteMpEvaluationItem] Error:', error);
    return res.status(500).json({ message: 'Error al eliminar item' });
  }
};

/* ------------------------------------------------------------------ */
/* POST /pending-subjects/qualification                                */
/* Save a qualification for an MP student                              */
/* The score is the final grade for this evaluation item.              */
/* For MP: if the student passes (score >= passing grade),             */
/* mark as approved immediately using the plan item's date.            */
/* No averaging — first pass wins.                                     */
/* ------------------------------------------------------------------ */
export const saveMpQualification = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const { evaluationPlanId, inscriptionSubjectId, score, isAbsent } = req.body;

    if (!Number.isFinite(evaluationPlanId) || !Number.isFinite(inscriptionSubjectId)) {
      return res.status(400).json({ message: 'evaluationPlanId e inscriptionSubjectId son requeridos' });
    }

    // Get the evaluation plan item to use its date
    const planItem = await EvaluationPlan.findByPk(evaluationPlanId, { transaction: t });
    if (!planItem) {
      return res.status(404).json({ message: 'Item de evaluación no encontrado' });
    }

    // Score 0 is treated as NP (inasistente), same logic as regular grades
    const rawScore = score ?? 0;
    const finalIsAbsent = isAbsent ?? (rawScore === 0);

    // Upsert qualification
    const existing = await Qualification.findOne({
      where: { evaluationPlanId, inscriptionSubjectId },
      transaction: t,
    });

    if (existing) {
      await existing.update({
        score: rawScore,
        isAbsent: finalIsAbsent,
      }, { transaction: t });
    } else {
      await Qualification.create({
        evaluationPlanId,
        inscriptionSubjectId,
        score: rawScore,
        isAbsent: finalIsAbsent,
      }, { transaction: t });
    }

    // For MP: if the student passes (score >= passing grade), mark as approved immediately
    // Use the plan item's date as the calculatedAt date
    // No averaging — first pass wins
    // NP (absent) is always failing
    const roundedScore = roundFinalGrade(rawScore);
    const status = finalIsAbsent ? 'reprobada' : resolveGradeStatus(roundedScore, 10);
    // DATEONLY returns a string 'YYYY-MM-DD'; parse as local noon to avoid TZ offset
    const rawPlanDate = planItem.date;
    const evaluationDate = rawPlanDate
      ? new Date(`${rawPlanDate}T12:00:00`)
      : new Date();

    // Get the inscription subject to find the inscription
    const insSubj = await InscriptionSubject.findByPk(inscriptionSubjectId, { transaction: t });

    if (insSubj) {
      // Always upsert the final grade — allow overwriting even if previously approved
      // This lets both teachers and Control de Estudios correct grades
      await SubjectFinalGrade.upsert({
        inscriptionSubjectId,
        finalScore: finalIsAbsent ? 0 : roundedScore,
        rawScore,
        status,
        calculatedAt: evaluationDate,
        gradeType: 'materia_pendiente',
      }, { transaction: t });

      // Update PendingSubject status
      const pending = await PendingSubject.findOne({
        where: { newInscriptionId: insSubj.inscriptionId, subjectId: insSubj.subjectId },
        transaction: t,
      });
      if (pending) {
        await pending.update({
          status: status === 'aprobada' ? 'aprobada' : 'pendiente',
          resolvedAt: status === 'aprobada' ? evaluationDate : null,
        }, { transaction: t });
      }
    }

    await t.commit();
    return res.json({ message: 'Calificación guardada', status, score: roundedScore, date: evaluationDate, isAbsent: finalIsAbsent });
  } catch (error) {
    await t.rollback();
    console.error('[saveMpQualification] Error:', error);
    return res.status(500).json({ message: 'Error al guardar calificación' });
  }
};

/* ====================================================================== */
/* ENCOUNTERS — Sistema de encuentros de Materia Pendiente                */
/* ====================================================================== */

/** Resolve the configured max encounters (default 4). */
async function getMaxEncounters(): Promise<number> {
  const setting = await Setting.findOne({ where: { key: 'pending_subject_max_encounters' } });
  if (setting) {
    const n = parseInt(setting.value, 10);
    if (Number.isFinite(n) && n >= 1) return n;
  }
  return 4;
}

/** Resolve the configured passing grade (default 10). */
async function getPassingGrade(): Promise<number> {
  const setting = await Setting.findOne({ where: { key: 'passing_grade' } });
  if (setting) {
    const n = parseInt(setting.value, 10);
    if (Number.isFinite(n)) return n;
  }
  return 10;
}

/** Ensure a PendingSubject has N encounter rows, creating missing ones. */
async function ensureEncounters(pendingSubjectId: number, maxEncounters: number, t?: any): Promise<PendingSubjectEncounter[]> {
  const existing = await PendingSubjectEncounter.findAll({
    where: { pendingSubjectId },
    order: [['encounterNumber', 'ASC']],
    transaction: t,
  });
  const existingNumbers = new Set(existing.map(e => e.encounterNumber));
  const toCreate: number[] = [];
  for (let i = 1; i <= maxEncounters; i++) {
    if (!existingNumbers.has(i)) toCreate.push(i);
  }
  if (toCreate.length > 0) {
    await PendingSubjectEncounter.bulkCreate(
      toCreate.map(n => ({ pendingSubjectId, encounterNumber: n })),
      { transaction: t }
    );
  }
  if (toCreate.length > 0) {
    return PendingSubjectEncounter.findAll({
      where: { pendingSubjectId },
      order: [['encounterNumber', 'ASC']],
      transaction: t,
    });
  }
  return existing;
}

/* ---------------------------------------------------------------------- */
/* GET /pending-subjects/:pendingSubjectId/encounters                      */
/* Returns the N encounters, auto-creating missing rows                   */
/* ---------------------------------------------------------------------- */
export const getMpEncounters = async (req: Request, res: Response) => {
  try {
    const pendingSubjectId = Number(req.params.pendingSubjectId);
    if (!Number.isFinite(pendingSubjectId)) {
      return res.status(400).json({ message: 'pendingSubjectId inválido' });
    }
    const pending = await PendingSubject.findByPk(pendingSubjectId);
    if (!pending) {
      return res.status(404).json({ message: 'Materia pendiente no encontrada' });
    }
    const maxEnc = await getMaxEncounters();
    const encounters = await ensureEncounters(pendingSubjectId, maxEnc);
    return res.json({
      pendingSubjectId,
      maxEncounters: maxEnc,
      status: pending.status,
      encounters: encounters.map(e => ({
        id: e.id,
        encounterNumber: e.encounterNumber,
        date: e.date,
        score: e.score,
        isAbsent: e.isAbsent,
      })),
    });
  } catch (error) {
    console.error('[getMpEncounters] Error:', error);
    return res.status(500).json({ message: 'Error al obtener encuentros' });
  }
};

/* ---------------------------------------------------------------------- */
/* PUT /pending-subjects/:pendingSubjectId/encounters                      */
/* Update dates for all encounters at once (professor or CE)              */
/* ---------------------------------------------------------------------- */
export const updateMpEncounterDates = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const pendingSubjectId = Number(req.params.pendingSubjectId);
    if (!Number.isFinite(pendingSubjectId)) {
      return res.status(400).json({ message: 'pendingSubjectId inválido' });
    }
    const { encounters } = req.body as {
      encounters: { encounterNumber: number; date?: string | null }[];
    };
    if (!Array.isArray(encounters)) {
      return res.status(400).json({ message: 'encounters debe ser un arreglo' });
    }
    const pending = await PendingSubject.findByPk(pendingSubjectId, { transaction: t });
    if (!pending) {
      await t.rollback();
      return res.status(404).json({ message: 'Materia pendiente no encontrada' });
    }
    const maxEnc = await getMaxEncounters();
    await ensureEncounters(pendingSubjectId, maxEnc, t);
    for (const enc of encounters) {
      if (!Number.isFinite(enc.encounterNumber)) continue;
      await PendingSubjectEncounter.update(
        { date: enc.date ?? null },
        { where: { pendingSubjectId, encounterNumber: enc.encounterNumber }, transaction: t }
      );
    }
    await t.commit();
    const updated = await PendingSubjectEncounter.findAll({
      where: { pendingSubjectId },
      order: [['encounterNumber', 'ASC']],
    });
    return res.json({
      message: 'Fechas actualizadas',
      encounters: updated.map(e => ({
        id: e.id,
        encounterNumber: e.encounterNumber,
        date: e.date,
        score: e.score,
        isAbsent: e.isAbsent,
      })),
    });
  } catch (error) {
    await t.rollback();
    console.error('[updateMpEncounterDates] Error:', error);
    return res.status(500).json({ message: 'Error al actualizar fechas' });
  }
};

/* ---------------------------------------------------------------------- */
/* POST /pending-subjects/:pendingSubjectId/encounters/:encounterNumber/score */
/* Register the score for a single encounter.                             */
/* If the student passes (>= passing_grade), the PendingSubject is        */
/* marked as 'aprobada' and remaining encounters are left null.           */
/* ---------------------------------------------------------------------- */
export const saveMpEncounterScore = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const pendingSubjectId = Number(req.params.pendingSubjectId);
    const encounterNumber = Number(req.params.encounterNumber);
    const { score, isAbsent } = req.body as { score: number; isAbsent?: boolean };

    if (!Number.isFinite(pendingSubjectId) || !Number.isFinite(encounterNumber)) {
      return res.status(400).json({ message: 'Parámetros inválidos' });
    }
    if (!Number.isFinite(score)) {
      return res.status(400).json({ message: 'score es requerido' });
    }

    const pending = await PendingSubject.findByPk(pendingSubjectId, { transaction: t });
    if (!pending) {
      await t.rollback();
      return res.status(404).json({ message: 'Materia pendiente no encontrada' });
    }
    if (pending.status === 'aprobada') {
      await t.rollback();
      return res.status(400).json({ message: 'Esta materia pendiente ya está aprobada' });
    }

    const maxEnc = await getMaxEncounters();
    const passingGrade = await getPassingGrade();
    await ensureEncounters(pendingSubjectId, maxEnc, t);

    const encounter = await PendingSubjectEncounter.findOne({
      where: { pendingSubjectId, encounterNumber },
      transaction: t,
    });
    if (!encounter) {
      await t.rollback();
      return res.status(404).json({ message: 'Encuentro no encontrado' });
    }

    const finalIsAbsent = isAbsent ?? (score === 0);
    const roundedScore = roundFinalGrade(score);
    const status = finalIsAbsent ? 'reprobada' : resolveGradeStatus(roundedScore, passingGrade);
    const evaluationDate = encounter.date
      ? new Date(`${encounter.date}T12:00:00`)
      : new Date();

    // Save encounter score
    await encounter.update({
      score: finalIsAbsent ? 0 : roundedScore,
      isAbsent: finalIsAbsent,
    }, { transaction: t });

    // If approved, mark PendingSubject as approved and update SubjectFinalGrade
    if (status === 'aprobada') {
      await pending.update({
        status: 'aprobada',
        resolvedAt: evaluationDate,
      }, { transaction: t });

      // Find the InscriptionSubject for this pending subject to upsert final grade
      const insSubj = await InscriptionSubject.findOne({
        where: { inscriptionId: pending.newInscriptionId, subjectId: pending.subjectId },
        transaction: t,
      });
      if (insSubj) {
        await SubjectFinalGrade.upsert({
          inscriptionSubjectId: insSubj.id,
          finalScore: roundedScore,
          rawScore: score,
          status: 'aprobada',
          calculatedAt: evaluationDate,
          gradeType: 'materia_pendiente',
        }, { transaction: t });
      }
    } else if (encounterNumber === maxEnc) {
      // Last encounter and still failing → mark as reprobada in SubjectFinalGrade
      const insSubj = await InscriptionSubject.findOne({
        where: { inscriptionId: pending.newInscriptionId, subjectId: pending.subjectId },
        transaction: t,
      });
      if (insSubj) {
        await SubjectFinalGrade.upsert({
          inscriptionSubjectId: insSubj.id,
          finalScore: finalIsAbsent ? 0 : roundedScore,
          rawScore: score,
          status: 'reprobada',
          calculatedAt: evaluationDate,
          gradeType: 'materia_pendiente',
        }, { transaction: t });
      }
    }

    await t.commit();
    return res.json({
      message: status === 'aprobada'
        ? 'Estudiante aprobó — no aparecerá en encuentros posteriores'
        : 'Nota guardada',
      status,
      score: finalIsAbsent ? 0 : roundedScore,
      isAbsent: finalIsAbsent,
      encounterNumber,
      approved: status === 'aprobada',
    });
  } catch (error) {
    await t.rollback();
    console.error('[saveMpEncounterScore] Error:', error);
    return res.status(500).json({ message: 'Error al guardar nota del encuentro' });
  }
};

/* ---------------------------------------------------------------------- */
/* GET /pending-subjects/nomina/:gradeId?encounter=N                      */
/* Nómina por encuentro: only students who haven't approved yet, with     */
/* the score for encounter N (or — if not yet graded).                    */
/* ---------------------------------------------------------------------- */
export const getMpNominaByEncounter = async (req: Request, res: Response) => {
  try {
    const { gradeId } = req.params;
    const encounterNumber = Number(req.query.encounter) || 1;
    const gradeIdNum = Number(gradeId);
    if (!Number.isFinite(gradeIdNum)) {
      return res.status(400).json({ message: 'gradeId inválido' });
    }

    const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });
    if (!activePeriod) {
      return res.json({ grade: null, subjects: [], students: [], encounterNumber });
    }

    const mpSection = await Section.findOne({ where: { name: MP_SECTION_NAME } });
    if (!mpSection) {
      return res.json({ grade: null, subjects: [], students: [], encounterNumber });
    }

    const pg = await PeriodGrade.findOne({
      where: { schoolPeriodId: activePeriod.id, gradeId: gradeIdNum },
    });
    if (!pg) {
      return res.json({ grade: null, subjects: [], students: [], encounterNumber });
    }

    const subjectOrderMap = await getSubjectOrderMap(pg.id);
    const pgsList = await PeriodGradeSubject.findAll({
      where: { periodGradeId: pg.id, active: true },
      include: [{ model: Subject, as: 'subject' }],
    });
    const subjects = pgsList
      .sort((a, b) => (subjectOrderMap.get(a.subjectId) ?? 99) - (subjectOrderMap.get(b.subjectId) ?? 99))
      .map(pgs => ({
        id: pgs.subjectId,
        name: (pgs as any).subject?.name,
        periodGradeSubjectId: pgs.id,
      }));

    // Get all MP inscriptions for this grade
    const inscriptions = await Inscription.findAll({
      where: {
        schoolPeriodId: activePeriod.id,
        gradeId: gradeIdNum,
        sectionId: mpSection.id,
      },
      include: [
        { model: Person, as: 'student' },
        {
          model: PendingSubject,
          as: 'pendingSubjects',
          required: true,
          where: { status: 'pendiente' },
          include: [
            {
              model: PendingSubjectEncounter,
              as: 'encounters',
              where: { encounterNumber },
              required: false,
            },
          ],
        },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          required: false,
        },
      ],
    });

    sortInscriptions(inscriptions as any[]);

    const students = inscriptions.map((ins: any) => ({
      inscriptionId: ins.id,
      personId: ins.personId,
      studentName: `${ins.student?.lastName} ${ins.student?.firstName}`,
      studentDni: ins.student?.document,
      documentType: ins.student?.documentType,
      subjects: ins.pendingSubjects?.map((ps: any) => {
        const enc = ps.encounters?.[0];
        // Find the matching InscriptionSubject for this pending subject
        const insSubj = ins.inscriptionSubjects?.find(
          (is: any) => is.subjectId === ps.subjectId
        );
        return {
          pendingSubjectId: ps.id,
          subjectId: ps.subjectId,
          inscriptionSubjectId: insSubj?.id ?? null,
          encounterScore: enc ? (enc.isAbsent ? 0 : enc.score) : null,
          encounterIsAbsent: enc ? enc.isAbsent : false,
          encounterDate: enc?.date ?? null,
        };
      }) || [],
    }));

    const grade = await Grade.findByPk(gradeIdNum);
    return res.json({ grade, subjects, students, encounterNumber });
  } catch (error) {
    console.error('[getMpNominaByEncounter] Error:', error);
    return res.status(500).json({ message: 'Error al obtener nómina por encuentro' });
  }
};

/* ---------------------------------------------------------------------- */
/* GET /pending-subjects/nomina-final/:gradeId                            */
/* Nómina final: all students who took MP this year, with their last      */
/* achieved score per subject (the encounter where they approved, or      */
/* the last encounter they took if they failed all).                      */
/* ---------------------------------------------------------------------- */
export const getMpNominaFinal = async (req: Request, res: Response) => {
  try {
    const { gradeId } = req.params;
    const gradeIdNum = Number(gradeId);
    if (!Number.isFinite(gradeIdNum)) {
      return res.status(400).json({ message: 'gradeId inválido' });
    }

    const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });
    if (!activePeriod) {
      return res.json({ grade: null, subjects: [], students: [] });
    }

    const mpSection = await Section.findOne({ where: { name: MP_SECTION_NAME } });
    if (!mpSection) {
      return res.json({ grade: null, subjects: [], students: [] });
    }

    const pg = await PeriodGrade.findOne({
      where: { schoolPeriodId: activePeriod.id, gradeId: gradeIdNum },
    });
    if (!pg) {
      return res.json({ grade: null, subjects: [], students: [] });
    }

    const subjectOrderMap = await getSubjectOrderMap(pg.id);
    const pgsList = await PeriodGradeSubject.findAll({
      where: { periodGradeId: pg.id, active: true },
      include: [{ model: Subject, as: 'subject' }],
    });
    const subjects = pgsList
      .sort((a, b) => (subjectOrderMap.get(a.subjectId) ?? 99) - (subjectOrderMap.get(b.subjectId) ?? 99))
      .map(pgs => ({
        id: pgs.subjectId,
        name: (pgs as any).subject?.name,
        periodGradeSubjectId: pgs.id,
      }));

    // Get ALL MP inscriptions (regardless of status) with their pending subjects + encounters
    const inscriptions = await Inscription.findAll({
      where: {
        schoolPeriodId: activePeriod.id,
        gradeId: gradeIdNum,
        sectionId: mpSection.id,
      },
      include: [
        { model: Person, as: 'student' },
        {
          model: PendingSubject,
          as: 'pendingSubjects',
          required: true,
          include: [
            {
              model: PendingSubjectEncounter,
              as: 'encounters',
              required: false,
            },
          ],
        },
      ],
    });

    sortInscriptions(inscriptions as any[]);

    const students = inscriptions.map((ins: any) => ({
      inscriptionId: ins.id,
      personId: ins.personId,
      studentName: `${ins.student?.lastName} ${ins.student?.firstName}`,
      studentDni: ins.student?.document,
      documentType: ins.student?.documentType,
      subjects: ins.pendingSubjects?.map((ps: any) => {
        const encs = (ps.encounters || []).sort((a: any, b: any) => b.encounterNumber - a.encounterNumber);
        // Find the last encounter with a non-null score
        const lastScored = encs.find((e: any) => e.score !== null || e.isAbsent);
        const approvedEnc = encs.find((e: any) => e.score !== null && e.score >= 10 && !e.isAbsent);
        return {
          pendingSubjectId: ps.id,
          subjectId: ps.subjectId,
          status: ps.status,
          finalScore: approvedEnc ? approvedEnc.score : (lastScored ? (lastScored.isAbsent ? 0 : lastScored.score) : null),
          finalEncounterNumber: approvedEnc ? approvedEnc.encounterNumber : (lastScored ? lastScored.encounterNumber : null),
          isAbsent: lastScored?.isAbsent ?? false,
        };
      }) || [],
    }));

    const grade = await Grade.findByPk(gradeIdNum);
    return res.json({ grade, subjects, students });
  } catch (error) {
    console.error('[getMpNominaFinal] Error:', error);
    return res.status(500).json({ message: 'Error al obtener nómina final' });
  }
};

/* ---------------------------------------------------------------------- */
/* GET /pending-subjects/:pendingSubjectId/content                        */
/* Returns the global content (theme title + items) for a MP subject.     */
/* ---------------------------------------------------------------------- */
export const getMpContent = async (req: Request, res: Response) => {
  try {
    const pendingSubjectId = Number(req.params.pendingSubjectId);
    if (!Number.isFinite(pendingSubjectId)) {
      return res.status(400).json({ message: 'pendingSubjectId inválido' });
    }
    const pending = await PendingSubject.findByPk(pendingSubjectId);
    if (!pending) {
      return res.status(404).json({ message: 'Materia pendiente no encontrada' });
    }
    let content = await PendingSubjectContent.findOne({
      where: { pendingSubjectId },
      include: [{
        model: PendingSubjectContentItem,
        as: 'items',
        order: [['order', 'ASC']],
      }],
    });
    if (!content) {
      // Auto-create empty content
      content = await PendingSubjectContent.create({ pendingSubjectId, themeTitle: '' });
    }
    const items = (content as any).items
      ? (content as any).items
      : await PendingSubjectContentItem.findAll({
          where: { contentId: content.id },
          order: [['order', 'ASC']],
        });
    return res.json({
      id: content.id,
      pendingSubjectId,
      themeTitle: content.themeTitle,
      items: items.map((it: any) => ({ id: it.id, text: it.text, order: it.order })),
    });
  } catch (error) {
    console.error('[getMpContent] Error:', error);
    return res.status(500).json({ message: 'Error al obtener contenido' });
  }
};

/* ---------------------------------------------------------------------- */
/* PUT /pending-subjects/:pendingSubjectId/content                        */
/* Upsert the global content (theme title + items).                       */
/* ---------------------------------------------------------------------- */
export const updateMpContent = async (req: Request, res: Response) => {
  const t = await sequelize.transaction();
  try {
    const pendingSubjectId = Number(req.params.pendingSubjectId);
    if (!Number.isFinite(pendingSubjectId)) {
      return res.status(400).json({ message: 'pendingSubjectId inválido' });
    }
    const { themeTitle, items } = req.body as {
      themeTitle: string;
      items: { text: string; order?: number }[];
    };
    const pending = await PendingSubject.findByPk(pendingSubjectId, { transaction: t });
    if (!pending) {
      await t.rollback();
      return res.status(404).json({ message: 'Materia pendiente no encontrada' });
    }

    // Upsert content record
    let content = await PendingSubjectContent.findOne({ where: { pendingSubjectId }, transaction: t });
    if (!content) {
      content = await PendingSubjectContent.create(
        { pendingSubjectId, themeTitle: themeTitle || '' },
        { transaction: t }
      );
    } else {
      await content.update({ themeTitle: themeTitle || '' }, { transaction: t });
    }

    // Replace all items (delete + recreate)
    await PendingSubjectContentItem.destroy({ where: { contentId: content.id }, transaction: t });
    if (Array.isArray(items) && items.length > 0) {
      await PendingSubjectContentItem.bulkCreate(
        items.map((it, idx) => ({
          contentId: content!.id,
          text: it.text,
          order: it.order ?? idx,
        })),
        { transaction: t }
      );
    }

    await t.commit();
    const freshItems = await PendingSubjectContentItem.findAll({
      where: { contentId: content.id },
      order: [['order', 'ASC']],
    });
    return res.json({
      id: content.id,
      pendingSubjectId,
      themeTitle: content.themeTitle,
      items: freshItems.map(it => ({ id: it.id, text: it.text, order: it.order })),
    });
  } catch (error) {
    await t.rollback();
    console.error('[updateMpContent] Error:', error);
    return res.status(500).json({ message: 'Error al guardar contenido' });
  }
};
