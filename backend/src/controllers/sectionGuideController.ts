import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { Person, Role, TeacherAssignment, PeriodGradeSubject, PeriodGrade, PeriodGradeSection, SectionGuide, Grade, Section, SchoolPeriod, Subject } from '@/models/index';

// GET /api/section-guides/teachers?schoolPeriodId=&gradeId=&sectionId=
// Returns all teachers assigned to that grade+section in the period, plus the current guide (if any)
export const getTeachersForSection = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId, gradeId, sectionId } = req.query;

    if (!schoolPeriodId || !gradeId || !sectionId) {
      return res.status(400).json({ message: 'Se requieren schoolPeriodId, gradeId y sectionId' });
    }

    // Find all TeacherAssignments for this period+grade+section
    const assignments = await TeacherAssignment.findAll({
      where: { sectionId: Number(sectionId) },
      include: [
        {
          model: PeriodGradeSubject,
          as: 'periodGradeSubject',
          required: true,
          include: [
            {
              model: PeriodGrade,
              as: 'periodGrade',
              required: true,
              where: {
                schoolPeriodId: Number(schoolPeriodId),
                gradeId: Number(gradeId),
              },
              include: [{ model: Grade, as: 'grade' }],
            },
            { model: Subject, as: 'subject' },
          ],
        },
        {
          model: Person,
          as: 'teacher',
          attributes: ['id', 'firstName', 'lastName', 'documentType', 'document'],
        },
      ],
    });

    // Deduplicate teachers (a teacher may teach multiple subjects in the same section)
    const teacherMap = new Map<number, { id: number; firstName: string; lastName: string; documentType: string; document: string; subjects: string[] }>();
    for (const a of assignments) {
      const t = (a as any).teacher;
      const subjName = (a as any).periodGradeSubject?.subject?.name || '';
      if (!t) continue;
      const existing = teacherMap.get(t.id);
      if (existing) {
        if (subjName && !existing.subjects.includes(subjName)) {
          existing.subjects.push(subjName);
        }
      } else {
        teacherMap.set(t.id, {
          id: t.id,
          firstName: t.firstName,
          lastName: t.lastName,
          documentType: t.documentType,
          document: t.document,
          subjects: subjName ? [subjName] : [],
        });
      }
    }

    // Find current guide
    const guide = await SectionGuide.findOne({
      where: {
        schoolPeriodId: Number(schoolPeriodId),
        gradeId: Number(gradeId),
        sectionId: Number(sectionId),
      },
    });

    const teachers = Array.from(teacherMap.values()).map(t => ({
      ...t,
      isGuide: guide ? guide.teacherId === t.id : false,
    }));

    // Sort: guide first, then by lastName
    teachers.sort((a, b) => {
      if (a.isGuide !== b.isGuide) return a.isGuide ? -1 : 1;
      return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
    });

    res.json({ teachers, guideTeacherId: guide?.teacherId || null });
  } catch (error) {
    console.error('[getTeachersForSection] Error:', error);
    res.status(500).json({ message: 'Error al obtener profesores de la sección' });
  }
};

// POST /api/section-guides
// Body: { teacherId, gradeId, sectionId, schoolPeriodId }
// Upserts the guide for that grade+section+period (only one allowed)
export const setSectionGuide = async (req: Request, res: Response) => {
  try {
    const { teacherId, gradeId, sectionId, schoolPeriodId } = req.body;

    if (!teacherId || !gradeId || !sectionId || !schoolPeriodId) {
      return res.status(400).json({ message: 'Se requieren teacherId, gradeId, sectionId y schoolPeriodId' });
    }

    // Verify the teacher has the Profesor role
    const teacher = await Person.findByPk(teacherId, {
      include: [{ model: Role, as: 'roles', where: { name: 'Profesor' }, through: { attributes: [] }, required: true }],
    });
    if (!teacher) {
      return res.status(404).json({ message: 'El profesor no existe o no tiene el rol Profesor' });
    }

    // Verify the teacher is assigned to this grade+section in the period
    const isAssigned = await TeacherAssignment.findOne({
      where: { teacherId: Number(teacherId), sectionId: Number(sectionId) },
      include: [
        {
          model: PeriodGradeSubject,
          as: 'periodGradeSubject',
          required: true,
          include: [
            {
              model: PeriodGrade,
              as: 'periodGrade',
              required: true,
              where: { schoolPeriodId: Number(schoolPeriodId), gradeId: Number(gradeId) },
            },
          ],
        },
      ],
    });
    if (!isAssigned) {
      return res.status(400).json({ message: 'El profesor no está asignado a esta sección en el período indicado' });
    }

    // Upsert: if a guide already exists for this grade+section+period, update the teacherId
    const [guide, created] = await SectionGuide.findOrCreate({
      where: { gradeId: Number(gradeId), sectionId: Number(sectionId), schoolPeriodId: Number(schoolPeriodId) },
      defaults: { teacherId: Number(teacherId), gradeId: Number(gradeId), sectionId: Number(sectionId), schoolPeriodId: Number(schoolPeriodId) },
    });

    if (!created && guide.teacherId !== Number(teacherId)) {
      await guide.update({ teacherId: Number(teacherId) });
    }

    res.json({ message: 'Profesor guía asignado correctamente', guide });
  } catch (error) {
    console.error('[setSectionGuide] Error:', error);
    res.status(500).json({ message: 'Error al asignar profesor guía' });
  }
};

// GET /api/section-guides?schoolPeriodId=&gradeId=&sectionId=
// Returns the current guide for that grade+section+period (with teacher info)
export const getSectionGuide = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId, gradeId, sectionId } = req.query;

    if (!schoolPeriodId || !gradeId || !sectionId) {
      return res.status(400).json({ message: 'Se requieren schoolPeriodId, gradeId y sectionId' });
    }

    const guide = await SectionGuide.findOne({
      where: {
        schoolPeriodId: Number(schoolPeriodId),
        gradeId: Number(gradeId),
        sectionId: Number(sectionId),
      },
      include: [
        { model: Person, as: 'guideTeacher', attributes: ['id', 'firstName', 'lastName', 'documentType', 'document'] },
        { model: Grade, as: 'grade' },
        { model: Section, as: 'section' },
        { model: SchoolPeriod, as: 'schoolPeriod' },
      ],
    });

    res.json(guide);
  } catch (error) {
    console.error('[getSectionGuide] Error:', error);
    res.status(500).json({ message: 'Error al obtener profesor guía' });
  }
};

// GET /api/section-guides/all?schoolPeriodId=
// Returns all sections across all grades for the period, each with its teachers and current guide
export const getAllGuidesForPeriod = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId } = req.query;

    if (!schoolPeriodId) {
      return res.status(400).json({ message: 'Se requiere schoolPeriodId' });
    }

    const periodId = Number(schoolPeriodId);

    // 1. Get all PeriodGrade records for this period (gives us grades)
    const periodGrades = await PeriodGrade.findAll({
      where: { schoolPeriodId: periodId },
      include: [{ model: Grade, as: 'grade' }],
    });

    // Sort by grade.order in JS (Sequelize nested order can be tricky)
    periodGrades.sort((a, b) => ((a as any).grade?.order || 0) - ((b as any).grade?.order || 0));

    // 2. Get all sections for these PeriodGrades
    const periodGradeIds = periodGrades.map(pg => pg.id);
    const pgsRecords = await PeriodGradeSection.findAll({
      where: { periodGradeId: periodGradeIds },
      include: [{ model: Section, as: 'section' }],
    });

    // 3. Get all TeacherAssignments for this period
    const assignments = await TeacherAssignment.findAll({
      where: { sectionId: pgsRecords.map(r => r.sectionId) },
      include: [
        {
          model: PeriodGradeSubject,
          as: 'periodGradeSubject',
          required: true,
          include: [
            {
              model: PeriodGrade,
              as: 'periodGrade',
              required: true,
              where: { schoolPeriodId: periodId },
            },
            { model: Subject, as: 'subject' },
          ],
        },
        {
          model: Person,
          as: 'teacher',
          attributes: ['id', 'firstName', 'lastName', 'documentType', 'document'],
        },
      ],
    });

    // 4. Get all SectionGuides for this period
    const guides = await SectionGuide.findAll({
      where: { schoolPeriodId: periodId },
    });
    const guideMap = new Map<string, number>();
    for (const g of guides) {
      guideMap.set(`${g.gradeId}-${g.sectionId}`, g.teacherId);
    }

    // 5. Build teacher map per section
    const sectionTeacherMap = new Map<number, Map<number, { id: number; firstName: string; lastName: string; documentType: string; document: string; subjects: string[] }>>();
    for (const a of assignments) {
      const t = (a as any).teacher;
      const subjName = (a as any).periodGradeSubject?.subject?.name || '';
      const sectionId = a.sectionId;
      if (!t) continue;
      if (!sectionTeacherMap.has(sectionId)) sectionTeacherMap.set(sectionId, new Map());
      const inner = sectionTeacherMap.get(sectionId)!;
      const existing = inner.get(t.id);
      if (existing) {
        if (subjName && !existing.subjects.includes(subjName)) existing.subjects.push(subjName);
      } else {
        inner.set(t.id, {
          id: t.id,
          firstName: t.firstName,
          lastName: t.lastName,
          documentType: t.documentType,
          document: t.document,
          subjects: subjName ? [subjName] : [],
        });
      }
    }

    // 6. Build response grouped by grade
    const result = periodGrades.map(pg => {
      const gradeId = pg.gradeId;
      const gradeName = (pg as any).grade?.name || '';
      const sectionsForGrade = pgsRecords.filter(r => r.periodGradeId === pg.id);
      const sections = sectionsForGrade.map(pgs => {
        const sectionId = pgs.sectionId;
        const sectionName = (pgs as any).section?.name || '';
        const teacherMap = sectionTeacherMap.get(sectionId);
        const teachers = teacherMap ? Array.from(teacherMap.values()) : [];
        teachers.sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`));
        const guideTeacherId = guideMap.get(`${gradeId}-${sectionId}`) || null;
        return { sectionId, sectionName, teachers, guideTeacherId };
      }).sort((a, b) => a.sectionName.localeCompare(b.sectionName));
      return { gradeId, gradeName, sections };
    });

    res.json(result);
  } catch (error) {
    console.error('[getAllGuidesForPeriod] Error:', error);
    res.status(500).json({ message: 'Error al obtener profesores guías' });
  }
};
