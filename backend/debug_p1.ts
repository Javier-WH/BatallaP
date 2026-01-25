
import { SchoolPeriod, PeriodGrade } from './src/models';
import sequelize from './src/config/database';

const run = async () => {
  try {
    const p1 = await SchoolPeriod.findByPk(1);
    console.log('Period 1:', p1?.name);

    if (p1) {
      const count = await PeriodGrade.count({ where: { schoolPeriodId: 1 } });
      console.log('Period 1 Grade Count:', count);
    }
  } catch (error) {
    console.error(error);
  }
};

run();
