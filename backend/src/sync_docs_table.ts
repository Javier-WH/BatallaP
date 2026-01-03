import EnrollmentDocument from './models/EnrollmentDocument';
import sequelize from './config/database';

const syncTable = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Sync only the new model
    // alter: true adds columns if table exists but diff, create if not exists
    await EnrollmentDocument.sync({ alter: true });

    console.log('EnrollmentDocument table synced successfully.');
  } catch (error) {
    console.error('Sync failed:', error);
  } finally {
    process.exit(0);
  }
};

syncTable();
