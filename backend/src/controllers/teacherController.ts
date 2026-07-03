import { Request, Response } from 'express';
import { Person, Role, TeacherAssignment, PeriodGradeSubject, Subject, Grade, Section, PeriodGrade, SchoolPeriod } from '@/models/index';
import { Op } from 'sequelize';

// Extender la interfaz de TeacherAssignment para TypeScript
interface TeacherAssignmentWithRelations extends TeacherAssignment {
  teacher?: Person;
  section?: Section;
}

export const getTeachers = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId } = req.query;
    let targetPeriodId = schoolPeriodId ? Number(schoolPeriodId) : null;

    if (!targetPeriodId) {
      const activePeriod = await SchoolPeriod.findOne({ where: { isActive: true } });
      if (activePeriod) targetPeriodId = activePeriod.id;
    }

    const teachers = await Person.findAll({
      include: [
        {
          model: Role,
          as: 'roles',
          where: { name: 'Profesor' },
          through: { attributes: [] }
        },
        {
          model: TeacherAssignment,
          as: 'teachingAssignments',
          required: false, // Important: keep all teachers in the list
          include: [
            {
              model: PeriodGradeSubject,
              as: 'periodGradeSubject',
              required: targetPeriodId ? true : false,
              include: [
                { model: Subject, as: 'subject' },
                {
                  model: PeriodGrade,
                  as: 'periodGrade',
                  required: targetPeriodId ? true : false,
                  where: targetPeriodId ? { schoolPeriodId: targetPeriodId } : {},
                  include: [
                    { model: Grade, as: 'grade' },
                    { model: SchoolPeriod, as: 'schoolPeriod' }
                  ]
                }
              ]
            },
            { model: Section, as: 'section' }
          ]
        }
      ]
    });
    res.json(teachers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching teachers' });
  }
};

export const getAvailableSubjectsForPeriod = async (req: Request, res: Response) => {
  try {
    const { periodId } = req.params;

    // Get all subjects defined for the period across all grades.
    // Order: periodGradeId ASC first (groups by grade), then PeriodGradeSubject.order ASC
    // (canonical order within each grade). See subjectOrderService for the rule.
    const subjects = await PeriodGradeSubject.findAll({
      include: [
        {
          model: PeriodGrade,
          as: 'periodGrade',
          where: { schoolPeriodId: periodId },
          include: [{ model: Grade, as: 'grade' }]
        },
        { model: Subject, as: 'subject' }
      ],
      order: [
        ['periodGradeId', 'ASC'],
        ['order', 'ASC'],
      ],
    });

    // Get all assigned subjects/sections to filter out or mark as assigned
    const assignments = await TeacherAssignment.findAll({
      include: [
        {
          model: PeriodGradeSubject,
          as: 'periodGradeSubject',
          where: { '$periodGrade.schoolPeriodId$': periodId },
          include: [{ model: PeriodGrade, as: 'periodGrade' }]
        }
      ]
    });

    res.json({ subjects, assignments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching available subjects' });
  }
};

export const assignTeacherToSubject = async (req: Request, res: Response) => {
  try {
    console.log('Datos recibidos en assignTeacherToSubject:', req.body);
    const { teacherId, periodGradeSubjectId, sectionId } = req.body;
    
    // Validar datos
    if (!teacherId || !periodGradeSubjectId || !sectionId) {
      console.error('Datos incompletos:', { teacherId, periodGradeSubjectId, sectionId });
      return res.status(400).json({ message: 'Datos incompletos. Se requiere teacherId, periodGradeSubjectId y sectionId' });
    }

    // Check if already assigned
    const existing = await TeacherAssignment.findOne({
      where: { periodGradeSubjectId, sectionId }
    });
    
    console.log('Asignación existente:', existing);

    if (existing) {
      // Obtener información del profesor ya asignado
      const existingAssignment = await TeacherAssignment.findOne({
        where: { periodGradeSubjectId, sectionId },
        include: [
          {
            model: Person,
            as: 'teacher',
            attributes: ['firstName', 'lastName']
          },
          {
            model: Section,
            as: 'section',
            attributes: ['name']
          }
        ]
      }) as unknown as TeacherAssignmentWithRelations;
      
      let teacherName = 'otro profesor';
      let sectionName = '';
      
      if (existingAssignment) {
        if (existingAssignment.teacher) {
          teacherName = `${existingAssignment.teacher.firstName} ${existingAssignment.teacher.lastName}`;
        }
        
        if (existingAssignment.section) {
          sectionName = existingAssignment.section.name;
        }
      }
      
      return res.status(400).json({ 
        message: `Esta materia ya tiene asignado al profesor ${teacherName} en la sección ${sectionName}` 
      });
    }

    // Verify the PeriodGradeSubject exists and is active (default scope)
    const pgs = await PeriodGradeSubject.findByPk(periodGradeSubjectId);
    if (!pgs) {
      return res.status(404).json({ message: 'La materia no existe o no está activa en este grado' });
    }

    const assignment = await TeacherAssignment.create({
      teacherId,
      periodGradeSubjectId,
      sectionId
    });

    res.json(assignment);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating assignment' });
  }
};

export const removeTeacherAssignment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await TeacherAssignment.destroy({ where: { id } });
    res.json({ message: 'Asignación eliminada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error removing assignment' });
  }
};
