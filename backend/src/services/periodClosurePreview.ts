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
  status: 'aprobado' | 'materias_pendientes' | 'reprobado';
  promotionGrade?: {
    id: number;
    name: string;
  } | null;
  inscription: {
    id: number;
    grade?: { id: number; name: string };
    section?: { id: number; name: string } | null;
    student?: { id: number; firstName: string; lastName: string; document?: string };
  };
}

export class PeriodClosurePreview {
  static async calculatePreview(schoolPeriodId: number): Promise<PreviewOutcome[]> {
    const minApprovalSetting = await Setting.findByPk('min_approval_grade');
    const minApproval = minApprovalSetting ? Number(minApprovalSetting.value) : 10;

    const inscriptions = (await Inscription.findAll({
      where: { schoolPeriodId },
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
        const summary = await FinalGradeCalculator.calculateForInscription(
          inscription.id,
          { minApproval }
        );

        const evaluation = await StudentPromotionEngine.evaluateInscription(
          inscription.id,
          summary
        );

        const { outcome, promotionGrade } = evaluation;

        previews.push({
          inscriptionId: inscription.id,
          finalAverage: outcome.finalAverage,
          failedSubjects: outcome.failedSubjects,
          status: outcome.status,
          promotionGrade: promotionGrade ? {
            id: promotionGrade.id,
            name: promotionGrade.name
          } : null,
          inscription: {
            id: inscription.id,
            grade: inscription.grade ? {
              id: inscription.grade.id,
              name: inscription.grade.name
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

    previews.sort((a, b) => b.failedSubjects - a.failedSubjects);

    return previews;
  }
}

export default PeriodClosurePreview;
