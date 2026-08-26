import sequelize from './src/config/database';
import { TeacherAssignment, Section, PeriodGrade, PeriodGradeSubject, EvaluationPlan, Qualification, Term, Grade, Subject } from './src/models/index';

async function check() {
  const mpSection = await Section.findOne({ where: { name: 'MATERIA PENDIENTE' } });
  const [activePeriodRows] = await sequelize.query(`SELECT id FROM school_periods WHERE status = 'activo' LIMIT 1`);
  const periodId = (activePeriodRows as any[])[0]?.id;
  console.log(`Active period id=${periodId}, MP section id=${mpSection?.id}`);

  // Get 4th grade assignments
  const assignments = await TeacherAssignment.findAll({
    include: [{
      model: PeriodGradeSubject,
      as: 'periodGradeSubject',
      required: true,
      include: [{
        model: PeriodGrade,
        as: 'periodGrade',
        required: true,
        where: { schoolPeriodId: periodId, gradeId: 4 },
        include: [{ model: Grade, as: 'grade' }],
      }, { model: Subject, as: 'subject' }],
    }, { model: Section, as: 'section' }],
  }) as any[];

  console.log(`\n4th grade assignments: ${assignments.length}`);

  const terms = await Term.findAll({ where: { schoolPeriodId: periodId } }) as any[];
  const activeTerm = terms.find(t => t.isActive);
  console.log(`Active term id=${activeTerm?.id}`);

  for (const a of assignments) {
    const subjName = a.periodGradeSubject?.subject?.name;
    const secName = a.section?.name;
    const isMP = a.sectionId === mpSection?.id;
    const pgsId = a.periodGradeSubjectId;

    const planCount = await EvaluationPlan.count({
      where: { periodGradeSubjectId: pgsId, sectionId: a.sectionId, ...(activeTerm ? { termId: activeTerm.id } : {}) },
    });
    const qualCount = await Qualification.count({
      include: [{
        model: EvaluationPlan,
        as: 'evaluationPlan',
        where: { periodGradeSubjectId: pgsId, sectionId: a.sectionId, ...(activeTerm ? { termId: activeTerm.id } : {}) },
        required: true,
      }],
    });
    console.log(`  ${isMP ? '[MP]' : '    '} ${subjName?.padEnd(40)} sec=${secName?.padEnd(20)} plans=${planCount} quals=${qualCount}`);
  }

  await sequelize.close();
  process.exit(0);
}
check().catch(e => { console.error(e); process.exit(1); });
