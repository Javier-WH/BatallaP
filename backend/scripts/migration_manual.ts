
import sequelize from '../src/config/database';
import { DataTypes } from 'sequelize';

const run = async () => {
  try {
    await sequelize.authenticate();
    console.log('Connected.');
    await sequelize.getQueryInterface().addColumn('enrollment_documents', 'pathInformesMedicos', {
      type: DataTypes.JSON,
      allowNull: true
    });
    console.log('Column added.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
};

run();
