import { Request, Response } from 'express';
import { Person, Role, TeacherAssignment, PeriodGradeSubject, Subject, Grade, Section, PeriodGrade, SchoolPeriod } from '@/models/index';
import { Op } from 'sequelize';

export const getTeachers = async (req: Request, res: Response) => {
  try {
    const teachers = await Person.findAll({
      include: [
        {
          model: Role,
          as: 'roles',
          where: { name: 'Teacher' },
          through: { attributes: [] }
        },
        {
          model: TeacherAssignment,
          as: 'teachingAssignments',
          include: [
            {
              model: PeriodGradeSubject,
              as: 'periodGradeSubject',
              include: [
                { model: Subject, as: 'subject' },
                { model: PeriodGrade, as: 'periodGrade', include: [{ model: Grade, as: 'grade' }] }
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

    // Get all subjects defined for the period across all grades
    const subjects = await PeriodGradeSubject.findAll({
      include: [
        {
          model: PeriodGrade,
          as: 'periodGrade',
          where: { schoolPeriodId: periodId },
          include: [{ model: Grade, as: 'grade' }]
        },
        { model: Subject, as: 'subject' }
      ]
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
    const { teacherId, periodGradeSubjectId, sectionId } = req.body;

    // Check if already assigned
    const existing = await TeacherAssignment.findOne({
      where: { periodGradeSubjectId, sectionId }
    });

    if (existing) {
      return res.status(400).json({ message: 'Esta materia y sección ya tienen un profesor asignado' });
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
