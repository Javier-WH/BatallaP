import { Op } from 'sequelize';
import {
  Grade,
  Inscription,
  InscriptionSubject,
  Person,
  Section,
  Setting
} from '@/models/index';
import { FinalGradeCalculator } from './finalGradeCalculator';
import { StudentPromotionEngine } from './studentPromotionEngine';

type InscriptionWithAssociations = Inscription & {
  student?: Person;
  grade?: Grade;
  section?: Section | null;
};

interface PreviewOutcome {
  inscriptionId: number;
  finalAverage: number | null;
  failedSubjects: number;
  failedSubjectNames: string[];
  status: 'aprobado' | 'materias_pendientes' | 'reprobado';
  isRezagado: boolean;
  graduatedAt: Date | null;
  approvedPendingSubjects: number;
  failedPendingSubjects: number;
  promotionGrade?: {
    id: number;
    name: string;
  } | null;
  inscription: {
    id: number;
    grade?: { id: number; name: string; order?: number };
    section?: { id: number; name: string } | null;
    student?: { id: number; firstName: string; lastName: string; document?: string };
  };
}

export class PeriodClosurePreview {
  static async calculatePreview(schoolPeriodId: number): Promise<PreviewOutcome[]> {
    const minApprovalSetting = await Setting.findByPk('min_approval_grade');
    const minApproval = minApprovalSetting ? Number(minApprovalSetting.value) : 10;

    // Only process MAIN inscriptions (regular / repitiente).
    // materia_pendiente inscriptions are evaluated via the MP discovery
    // inside StudentPromotionEngine — they should not get their own preview
    // entry.
    const inscriptions = (await Inscription.findAll({
      where: {
        schoolPeriodId,
        escolaridad: { [Op.in]: ['regular', 'repitiente'] },
        withdrawnAt: null
      },
      include: [
        { model: Person, as: 'student' },
        { model: Grade, as: 'grade' },
        { model: Section, as: 'section' },
        {
          model: InscriptionSubject,
          as: 'inscriptionSubjects',
          required: false
        }
      ]
    })) as InscriptionWithAssociations[];

    const previews: PreviewOutcome[] = [];

    for (const inscription of inscriptions) {
      try {
        const summary = await FinalGradeCalculator.calculateForInscriptionFast(
          inscription.id,
          { minApproval }
        );

        // Preview mode: persist=false → no StudentPeriodOutcome is created/updated.
        const evaluation = await StudentPromotionEngine.evaluateInscription(
          inscription.id,
          summary,
          { persist: false }
        );

        const { promotionGrade, approvedPendingSubjectIds, failedPendingSubjectIds, isRezagado, status, graduatedAt, finalAverage, failedSubjects } = evaluation;

        // Collect the names of failed subjects for the tooltip
        const failedSubjectNames = summary.subjectResults
          .filter(r => r.status === 'reprobada')
          .map(r => r.subjectName || `Materia #${r.subjectId}`);

        previews.push({
          inscriptionId: inscription.id,
          finalAverage,
          failedSubjects,
          failedSubjectNames,
          status,
          isRezagado,
          graduatedAt,
          approvedPendingSubjects: approvedPendingSubjectIds.length,
          failedPendingSubjects: failedPendingSubjectIds.length,
          promotionGrade: promotionGrade ? {
            id: promotionGrade.id,
            name: promotionGrade.name
          } : null,
          inscription: {
            id: inscription.id,
            grade: inscription.grade ? {
              id: inscription.grade.id,
              name: inscription.grade.name,
              order: (inscription.grade as any).order,
            } : undefined,
            section: inscription.section ? {
              id: inscription.section.id,
              name: inscription.section.name
            } : null,
            student: inscription.student ? {
              id: inscription.student.id,
              firstName: inscription.student.firstName,
              lastName: inscription.student.lastName,
              document: inscription.student.document
            } : undefined
          }
        });
      } catch (error) {
        console.error(`Error calculating preview for inscription ${inscription.id}:`, error);
      }
    }

    // Sort by grade order, then section name, then student document (cedula)
    const naturalCollator = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
    previews.sort((a, b) => {
      const gradeOrderA = a.inscription.grade?.order ?? Number.MAX_SAFE_INTEGER;
      const gradeOrderB = b.inscription.grade?.order ?? Number.MAX_SAFE_INTEGER;
      if (gradeOrderA !== gradeOrderB) return gradeOrderA - gradeOrderB;

      const sectionA = a.inscription.section?.name ?? '';
      const sectionB = b.inscription.section?.name ?? '';
      const sectionCmp = sectionA.localeCompare(sectionB, 'es', { sensitivity: 'base' });
      if (sectionCmp !== 0) return sectionCmp;

      const docA = a.inscription.student?.document ?? '';
      const docB = b.inscription.student?.document ?? '';
      return docA.localeCompare(docB, 'es', { numeric: true });
    });

    return previews;
  }
}

export default PeriodClosurePreview;
