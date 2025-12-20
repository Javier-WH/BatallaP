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
        { model: Section, as: 'section' }
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
          required: false, // Change to false to avoid filtering out students without subjects records yet
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

    // Robust handling: If inscriptionSubjectId is missing but we have inscriptionId, we can resolve it
    if (!finalInscriptionSubjectId && inscriptionId) {
      const evalPlan = await EvaluationPlan.findByPk(evaluationPlanId, {
        include: [{ model: PeriodGradeSubject, as: 'periodGradeSubject' }]
      });

      const ep = evalPlan as any;
      if (ep && ep.periodGradeSubject) {
        const [insSub] = await InscriptionSubject.findOrCreate({
          where: {
            inscriptionId,
            subjectId: ep.periodGradeSubject.subjectId
          },
          defaults: {
            inscriptionId,
            subjectId: ep.periodGradeSubject.subjectId
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
