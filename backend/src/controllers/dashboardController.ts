import { Request, Response } from 'express';
import { Op, fn, col, literal } from 'sequelize';
import SchoolPeriod from '@/models/SchoolPeriod';
import Inscription from '@/models/Inscription';
import Matriculation from '@/models/Matriculation';
import Term from '@/models/Term';
import TeacherAssignment from '@/models/TeacherAssignment';
import PeriodGradeSubject from '@/models/PeriodGradeSubject';
import PeriodGrade from '@/models/PeriodGrade';
import PeriodGradeSection from '@/models/PeriodGradeSection';
import Grade from '@/models/Grade';
import Section from '@/models/Section';
import Person from '@/models/Person';
import Subject from '@/models/Subject';
import EvaluationPlan from '@/models/EvaluationPlan';
import Qualification from '@/models/Qualification';
import ThematicComponent from '@/models/ThematicComponent';
import ExpectedLearningContent from '@/models/ExpectedLearningContent';
import Setting from '@/models/Setting';
import User from '@/models/User';
import { PeriodClosureService } from '@/services/periodClosureService';

interface TeacherAssignmentWithRelations extends TeacherAssignment {
  teacher?: Person;
  section?: Section;
  periodGradeSubject?: PeriodGradeSubject & {
    periodGrade?: PeriodGrade & { grade?: Grade };
    subject?: Subject;
  };
}

const assignmentKey = (pgsId: number, sectionId: number) => `${pgsId}:${sectionId}`;

type AcademicSnapshot =
  | { period: null }
  | {
      period: { id: number; name: string; period: string };
      students: { total: number; matriculated: number; pending: number };
      lapses: {
        total: number;
        blocked: number;
        terms: { id: number; name: string; order: number; isBlocked: boolean; openDate?: Date | null; closeDate?: Date | null }[];
      };
      council: {
        checklist: { total: number; done: number };
        blockedTerms: number;
        totalTerms: number;
      };
      teachers: {
        totalAssignments: number;
        withoutPlans: number;
        withoutGrades: number;
        sampleWithoutPlans: AssignmentInsight[];
        sampleWithoutGrades: AssignmentInsight[];
        byGrade: GradeProgress[];
        byGradeContent: ContentGradeProgress[];
      };
    };

interface AssignmentInsight {
  teacher: string;
  subject: string;
  grade: string;
  section: string;
}

interface SectionDetail {
  sectionId: number;
  sectionName: string;
  sectionColor: string;
  teacherName: string;
  hasPlan: boolean;
  hasGrades: boolean;
}

interface SubjectProgress {
  subjectId: number;
  subjectName: string;
  subjectIcon: string | null;
  subjectColor: string | null;
  subjectAbbreviation: string | null;
  order: number;
  totalSections: number;
  withPlan: number;
  withoutPlan: number;
  withGrades: number;
  withoutGrades: number;
  sections: SectionDetail[];
}

interface GradeProgress {
  gradeId: number;
  gradeName: string;
  gradeColor: string | null;
  gradeOrder: number;
  subjects: SubjectProgress[];
}

interface ContentSubjectProgress {
  subjectId: number;
  subjectName: string;
  subjectIcon: string | null;
  subjectColor: string | null;
  subjectAbbreviation: string | null;
  order: number;
  hasContent: boolean;
}

interface ContentGradeProgress {
  gradeId: number;
  gradeName: string;
  gradeColor: string | null;
  gradeOrder: number;
  subjects: ContentSubjectProgress[];
}

const buildAcademicSnapshot = async (): Promise<AcademicSnapshot> => {
  const activePeriod = await SchoolPeriod.findOne({ where: { status: 'activo' } });

  if (!activePeriod) {
    return { period: null };
  }

  const [matriculatedCount, pendingMatriculations, terms] = await Promise.all([
    Inscription.count({ where: { schoolPeriodId: activePeriod.id } }),
    Matriculation.count({ where: { schoolPeriodId: activePeriod.id, status: 'pending' } }),
    Term.findAll({
      where: { schoolPeriodId: activePeriod.id },
      order: [['order', 'ASC']],
      attributes: ['id', 'name', 'order', 'isBlocked', 'openDate', 'closeDate']
    })
  ]);

  const closureStatus = await PeriodClosureService.getStatus(activePeriod.id);

  const assignments = (await TeacherAssignment.findAll({
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
            where: { schoolPeriodId: activePeriod.id },
            attributes: ['id', 'schoolPeriodId', 'gradeId', 'color'],
            include: [{ model: Grade, as: 'grade', attributes: ['id', 'name', 'order'] }]
          },
          { model: Subject, as: 'subject', attributes: ['id', 'name', 'icon', 'color', 'abbreviation'] }
        ]
      },
      { model: Section, as: 'section', attributes: ['id', 'name'] },
      { model: Person, as: 'teacher', attributes: ['id', 'firstName', 'lastName'] }
    ]
  })) as TeacherAssignmentWithRelations[];

  const termIds = terms.map(term => term.id);

  const periodGradeSubjectIds = assignments.map(a => a.periodGradeSubjectId);
  const sectionIds = assignments.map(a => a.sectionId);

  if (periodGradeSubjectIds.length === 0 || sectionIds.length === 0) {
    return {
      period: { id: activePeriod.id, name: activePeriod.name, period: activePeriod.period },
      students: {
        matriculated: matriculatedCount,
        pending: pendingMatriculations,
        total: matriculatedCount + pendingMatriculations
      },
      lapses: {
        total: terms.length,
        blocked: terms.filter(term => term.isBlocked).length,
        terms
      },
      council: {
        checklist: closureStatus.checklist,
        blockedTerms: closureStatus.blockedTerms,
        totalTerms: closureStatus.totalTerms
      },
      teachers: {
        totalAssignments: assignments.length,
        withoutPlans: 0,
        withoutGrades: 0,
        sampleWithoutPlans: [],
        sampleWithoutGrades: [],
        byGrade: [],
        byGradeContent: []
      }
    };
  }

  const evaluationPlanCountsRaw = await EvaluationPlan.findAll({
    attributes: [
      'periodGradeSubjectId',
      'sectionId',
      [fn('COUNT', literal('*')), 'planCount']
    ],
    where: {
      periodGradeSubjectId: { [Op.in]: periodGradeSubjectIds },
      sectionId: { [Op.in]: sectionIds }
    },
    group: ['periodGradeSubjectId', 'sectionId'],
    raw: true
  });
  const evaluationPlanCounts = evaluationPlanCountsRaw as unknown as {
    periodGradeSubjectId: number;
    sectionId: number;
    planCount: number;
  }[];

  const qualificationCountsRaw = await Qualification.findAll({
    attributes: [
      [col('evaluationPlan.periodGradeSubjectId'), 'periodGradeSubjectId'],
      [col('evaluationPlan.sectionId'), 'sectionId'],
      [fn('COUNT', literal('*')), 'qualificationCount']
    ],
    include: [
      {
        model: EvaluationPlan,
        as: 'evaluationPlan',
        attributes: [],
        required: true,
        where: termIds.length > 0 ? { termId: { [Op.in]: termIds } } : {}
      }
    ],
    group: ['evaluationPlan.periodGradeSubjectId', 'evaluationPlan.sectionId'],
    raw: true
  });
  const qualificationCounts = qualificationCountsRaw as unknown as {
    periodGradeSubjectId: number;
    sectionId: number;
    qualificationCount: number;
  }[];

  const planMap = new Map<string, number>();
  evaluationPlanCounts.forEach(record => {
    const key = assignmentKey(record.periodGradeSubjectId, record.sectionId);
    planMap.set(key, record.planCount);
  });

  const qualificationMap = new Map<string, number>();
  qualificationCounts.forEach(record => {
    const key = assignmentKey(record.periodGradeSubjectId, record.sectionId);
    qualificationMap.set(key, record.qualificationCount);
  });

  const assignmentsWithoutPlan: AssignmentInsight[] = [];
  const assignmentsWithoutGrades: AssignmentInsight[] = [];

  assignments.forEach(assignment => {
    const key = assignmentKey(assignment.periodGradeSubjectId, assignment.sectionId);
    const baseInfo: AssignmentInsight = {
      teacher: assignment.teacher ? `${assignment.teacher.firstName} ${assignment.teacher.lastName}` : 'Sin asignar',
      subject: assignment.periodGradeSubject?.subject?.name || 'Materia',
      grade: assignment.periodGradeSubject?.periodGrade?.grade?.name || 'Grado',
      section: assignment.section?.name || '—'
    };

    if (!planMap.get(key)) {
      assignmentsWithoutPlan.push(baseInfo);
    }

    if (!qualificationMap.get(key)) {
      assignmentsWithoutGrades.push(baseInfo);
    }
  });

  // Fetch section colors from PeriodGradeSection for all periodGradeId + sectionId pairs
  const periodGradeIds = [...new Set(assignments.map(a => a.periodGradeSubject?.periodGradeId).filter(Boolean) as number[])];
  const sectionColorMap = new Map<string, string>();
  if (periodGradeIds.length > 0) {
    const pgsRecords = await PeriodGradeSection.findAll({
      where: { periodGradeId: { [Op.in]: periodGradeIds } },
      attributes: ['periodGradeId', 'sectionId', 'color'],
    });
    pgsRecords.forEach(r => {
      sectionColorMap.set(`${r.periodGradeId}:${r.sectionId}`, r.color);
    });
  }

  // Build byGrade structure: group assignments by grade → subject → sections
  const gradeMap = new Map<number, { gradeName: string; gradeColor: string | null; gradeOrder: number; subjects: Map<number, SubjectProgress> }>();

  assignments.forEach(assignment => {
    const periodGrade = assignment.periodGradeSubject?.periodGrade;
    const grade = periodGrade?.grade;
    const subject = assignment.periodGradeSubject?.subject;
    const pgsOrder = assignment.periodGradeSubject?.order ?? Number.MAX_SAFE_INTEGER;
    if (!grade || !subject) return;

    if (!gradeMap.has(grade.id)) {
      gradeMap.set(grade.id, {
        gradeName: grade.name,
        gradeColor: periodGrade?.color ?? null,
        gradeOrder: grade.order ?? Number.MAX_SAFE_INTEGER,
        subjects: new Map(),
      });
    }
    const gradeEntry = gradeMap.get(grade.id)!;

    if (!gradeEntry.subjects.has(subject.id)) {
      gradeEntry.subjects.set(subject.id, {
        subjectId: subject.id,
        subjectName: subject.name,
        subjectIcon: subject.icon ?? null,
        subjectColor: subject.color ?? null,
        subjectAbbreviation: subject.abbreviation ?? null,
        order: pgsOrder,
        totalSections: 0,
        withPlan: 0,
        withoutPlan: 0,
        withGrades: 0,
        withoutGrades: 0,
        sections: [],
      });
    }
    const subjProgress = gradeEntry.subjects.get(subject.id)!;

    const key = assignmentKey(assignment.periodGradeSubjectId, assignment.sectionId);
    const hasPlan = !!planMap.get(key);
    const hasGrades = !!qualificationMap.get(key);
    const teacherName = assignment.teacher
      ? `${assignment.teacher.firstName} ${assignment.teacher.lastName}`
      : 'Sin asignar';
    const sectionName = assignment.section?.name || '—';
    const sectionId = assignment.sectionId;
    const sectionColor = sectionColorMap.get(`${periodGrade?.id}:${sectionId}`) || '#cccccc';

    subjProgress.totalSections += 1;
    if (hasPlan) subjProgress.withPlan += 1; else subjProgress.withoutPlan += 1;
    if (hasGrades) subjProgress.withGrades += 1; else subjProgress.withoutGrades += 1;
    subjProgress.sections.push({ sectionId, sectionName, sectionColor, teacherName, hasPlan, hasGrades });
  });

  // Convert maps to sorted arrays: grades by Grade.order, sections alphabetically
  const byGrade: GradeProgress[] = Array.from(gradeMap.entries())
    .map(([gradeId, entry]) => ({
      gradeId,
      gradeName: entry.gradeName,
      gradeColor: entry.gradeColor,
      gradeOrder: entry.gradeOrder,
      subjects: Array.from(entry.subjects.values())
        .map(s => ({
          ...s,
          sections: s.sections.sort((a, b) => a.sectionName.localeCompare(b.sectionName, 'es')),
        }))
        .sort((a, b) => a.order - b.order),
    }))
    .sort((a, b) => a.gradeOrder - b.gradeOrder);

  // ===== Content progress: check which pgsIds have the full chain Component → Content → Learning =====
  const pgsIdsInPeriod = [...new Set(assignments.map(a => a.periodGradeSubject?.id).filter(Boolean) as number[])];

  const pgsWithContent = new Set<number>();
  if (pgsIdsInPeriod.length > 0) {
    const contentChain = await ThematicComponent.findAll({
      attributes: ['id', 'periodGradeSubjectId'],
      where: { periodGradeSubjectId: { [Op.in]: pgsIdsInPeriod } },
      include: [{
        association: 'contents',
        attributes: ['id'],
        required: true,
        include: [{
          association: 'learnings',
          attributes: ['id'],
          required: true,
          through: { attributes: [] },
        }],
      }],
    });
    contentChain.forEach(comp => {
      if (comp.periodGradeSubjectId) pgsWithContent.add(comp.periodGradeSubjectId);
    });
  }

  // Build pgsId → grade/subject info map from assignments
  const pgsInfoMap = new Map<number, {
    gradeId: number; gradeName: string; gradeColor: string | null; gradeOrder: number;
    subjectId: number; subjectName: string; subjectIcon: string | null;
    subjectColor: string | null; subjectAbbreviation: string | null; order: number;
  }>();
  assignments.forEach(a => {
    const pgs = a.periodGradeSubject;
    const grade = pgs?.periodGrade?.grade;
    const subject = pgs?.subject;
    if (!grade || !subject || !pgs?.id || pgsInfoMap.has(pgs.id)) return;
    pgsInfoMap.set(pgs.id, {
      gradeId: grade.id,
      gradeName: grade.name,
      gradeColor: pgs.periodGrade?.color ?? null,
      gradeOrder: grade.order ?? Number.MAX_SAFE_INTEGER,
      subjectId: subject.id,
      subjectName: subject.name,
      subjectIcon: subject.icon ?? null,
      subjectColor: subject.color ?? null,
      subjectAbbreviation: subject.abbreviation ?? null,
      order: a.periodGradeSubject?.order ?? Number.MAX_SAFE_INTEGER,
    });
  });

  // Group by grade
  const contentGradeMap = new Map<number, ContentGradeProgress>();
  pgsInfoMap.forEach((info, pgsId) => {
    if (!contentGradeMap.has(info.gradeId)) {
      contentGradeMap.set(info.gradeId, {
        gradeId: info.gradeId,
        gradeName: info.gradeName,
        gradeColor: info.gradeColor,
        gradeOrder: info.gradeOrder,
        subjects: [],
      });
    }
    contentGradeMap.get(info.gradeId)!.subjects.push({
      subjectId: info.subjectId,
      subjectName: info.subjectName,
      subjectIcon: info.subjectIcon,
      subjectColor: info.subjectColor,
      subjectAbbreviation: info.subjectAbbreviation,
      order: info.order,
      hasContent: pgsWithContent.has(pgsId),
    });
  });

  const byGradeContent: ContentGradeProgress[] = Array.from(contentGradeMap.values())
    .map(g => ({
      ...g,
      subjects: g.subjects.sort((a, b) => a.order - b.order),
    }))
    .sort((a, b) => a.gradeOrder - b.gradeOrder);

  return {
    period: { id: activePeriod.id, name: activePeriod.name, period: activePeriod.period },
    students: {
      matriculated: matriculatedCount,
      pending: pendingMatriculations,
      total: matriculatedCount + pendingMatriculations
    },
    lapses: {
      total: terms.length,
      blocked: terms.filter(term => term.isBlocked).length,
      terms
    },
    council: {
      checklist: closureStatus.checklist,
      blockedTerms: closureStatus.blockedTerms,
      totalTerms: closureStatus.totalTerms
    },
    teachers: {
      totalAssignments: assignments.length,
      withoutPlans: assignmentsWithoutPlan.length,
      withoutGrades: assignmentsWithoutGrades.length,
      sampleWithoutPlans: assignmentsWithoutPlan.slice(0, 6),
      sampleWithoutGrades: assignmentsWithoutGrades.slice(0, 6),
      byGrade,
      byGradeContent
    }
  };
};

export const getControlPanelMetrics = async (req: Request, res: Response) => {
  try {
    const snapshot = await buildAcademicSnapshot();
    return res.json(snapshot);
  } catch (error) {
    console.error('Error fetching control panel metrics:', error);
    return res.status(500).json({ message: 'Error obteniendo métricas del panel de control' });
  }
};

export const getMasterDashboardMetrics = async (req: Request, res: Response) => {
  try {
    const [academic, totalUsers, settingsList] = await Promise.all([
      buildAcademicSnapshot(),
      User.count(),
      Setting.findAll({
        where: { key: { [Op.in]: ['institution_name', 'institution_logo_shape', 'institution_motto', 'institution_code'] } }
      })
    ]);

    const settingsMap = settingsList.reduce<Record<string, string>>((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    const institution = {
      name: settingsMap.institution_name || 'Institución Educativa',
      logoShape: (settingsMap.institution_logo_shape as 'circle' | 'square') || 'square',
      logoUrl: `${baseUrl}/api/upload/logo?t=${Date.now()}`,
      motto: settingsMap.institution_motto || '',
      code: settingsMap.institution_code || ''
    };

    return res.json({
      academic,
      users: { total: totalUsers },
      institution
    });
  } catch (error) {
    console.error('Error fetching master dashboard metrics:', error);
    return res.status(500).json({ message: 'Error obteniendo métricas del panel maestro' });
  }
};
