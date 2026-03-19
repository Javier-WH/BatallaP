
import { SchoolPeriod, Grade, PeriodGrade, Subject } from './src/models';
import sequelize from './src/config/database';

const run = async () => {
  try {
    const activePeriod = await SchoolPeriod.findOne({ where: { isActive: true } });
    console.log('Active Period:', activePeriod?.id, activePeriod?.name);

    const grades = await Grade.findAll();
    console.log('Available Grades:', grades.map(g => ({ id: g.id, name: g.name })));

    if (activePeriod) {
      const periodGrades = await PeriodGrade.findAll({
        where: { schoolPeriodId: activePeriod.id },
        include: [{ model: Grade, as: 'grade' }, { model: Subject, as: 'subjects' }]
      });
      console.log('Period Grades configuration:', periodGrades.map((pg: any) => ({
        id: pg.id,
        grade: pg.grade?.name,
        subjectCount: pg.subjects?.length
      })));
    }

  } catch (error) {
    console.error(error);
  } finally {
    // await sequelize.close();
  }
};

run();
