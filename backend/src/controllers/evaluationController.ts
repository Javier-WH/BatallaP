import { Request, Response } from 'express';
import {
  Person,
  TeacherAssignment,
  PeriodGradeSubject,
  Subject,
  Grade,
  Section,
  PeriodGrade,
  SchoolPeriod,
  EvaluationPlan,
  Qualification,
  Inscription,
  InscriptionSubject
} from '@/models/index';

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
        { model: Section, as: 'section' }
      ]
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
    const { term } = req.query;

    const where: any = { periodGradeSubjectId };
    if (term) where.term = term;

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
    await item.update(req.body);
    res.json(item);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteEvaluationItem = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
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
        gradeId: pg.gradeId,
        sectionId
      },
      include: [
        { model: Person, as: 'student' },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          where: { subjectId: periodGradeSubject.subjectId },
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
    const { evaluationPlanId, inscriptionSubjectId, score, observations } = req.body;

    // Check if exists to update, else create
    const [qualification, created] = await Qualification.findOrCreate({
      where: { evaluationPlanId, inscriptionSubjectId },
      defaults: { evaluationPlanId, inscriptionSubjectId, score, observations }
    });

    if (!created) {
      await qualification.update({ score, observations });
    }

    res.json(qualification);
  } catch (error) {
    console.error(error);
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
            { model: Subject, as: 'subject' },
            {
              model: Qualification,
              as: 'qualifications',
              include: [{ model: EvaluationPlan, as: 'evaluationPlan' }]
            }
          ]
        }
      ],
      order: [
        [{ model: SchoolPeriod, as: 'period' }, 'id', 'DESC'],
        [{ model: InscriptionSubject, as: 'inscriptionSubjects' }, { model: Subject, as: 'subject' }, 'name', 'ASC']
      ]
    });

    res.json(records);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al obtener historial' });
  }
};
