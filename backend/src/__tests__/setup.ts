import sequelize from '@/config/database';
import '@/models/index';
import { sessionStore } from '@/app';

const isSqlite = (sequelize as any).options?.dialectName === 'sqlite' ||
  (sequelize.getDialect && sequelize.getDialect() === 'sqlite');

// Disable logging for tests
(sequelize as any).options.logging = false;

beforeAll(async () => {
  try {
    await sequelize.authenticate();
    // In-memory SQLite starts empty: create all tables from the Sequelize models.
    // For MySQL we rely on the existing schema (no sync here).
    if (isSqlite) {
      await sequelize.sync({ force: true });
      // Ensure the session store table exists (connect-session-sequelize syncs
      // asynchronously in its constructor, which may not have completed yet).
      const sessionModel = (sessionStore as any).sessionModel;
      if (sessionModel && typeof sessionModel.sync === 'function') {
        await sessionModel.sync({ force: true });
      }
    }
    console.log(`Test database connected (dialect=${sequelize.getDialect()})`);
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
  // Truncate all tables before each test, dialect-aware.
  try {
    if (isSqlite) {
      // SQLite: disable FK enforcement during cleanup, then delete rows.
      await sequelize.query('PRAGMA foreign_keys = OFF');
      const modelNames = Object.keys(sequelize.models);
      const tableNames = modelNames.map((name) => {
        const model = sequelize.models[name];
        const tableName = model.getTableName();
        return typeof tableName === 'string' ? tableName : name;
      });
      for (const table of tableNames) {
        await sequelize.query(`DELETE FROM "${table}"`);
      }
      // Reset autoincrement sequences for SQLite.
      for (const table of tableNames) {
        try {
          await sequelize.query(
            `DELETE FROM sqlite_sequence WHERE name = '${table}'`
          );
        } catch {
          // sqlite_sequence only exists after the first AUTOINCREMENT insert.
        }
      }
      await sequelize.query('PRAGMA foreign_keys = ON');
    } else {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
      const tables = Object.keys(sequelize.models);
      for (const table of tables) {
        await sequelize.models[table].destroy({
          where: {},
          truncate: true,
          cascade: true,
        });
      }
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    }
  } catch (error) {
    console.error('Error cleaning database:', error);
  }
});
