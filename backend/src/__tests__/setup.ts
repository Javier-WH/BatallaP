import sequelize from '@/config/database';

// Disable logging for tests
(sequelize as any).options.logging = false;

beforeAll(async () => {
  try {
    await sequelize.authenticate();
    console.log('Test database connected');
  } catch (error) {
    console.error('Unable to connect to test database:', error);
    throw error;
  }
});

afterAll(async () => {
  try {
    await sequelize.close();
    console.log('Test database connection closed');
  } catch (error) {
    console.error('Error closing test database:', error);
  }
});

beforeEach(async () => {
  // Truncate all tables before each test
  try {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    
    const tables = Object.keys(sequelize.models);
    for (const table of tables) {
      await sequelize.models[table].destroy({ 
        where: {}, 
        truncate: true, 
        cascade: true
      });
    }
    
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
  } catch (error) {
    console.error('Error cleaning database:', error);
  }
});
