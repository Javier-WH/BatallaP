import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config({ path: process.env.ENV_FILE || '.env' });

const dbName = process.env.DB_NAME || 'bp';
const dbUser = process.env.DB_USER || 'root';
const dbPass = process.env.DB_PASS || '';
const dbHost = process.env.DB_HOST || 'localhost';
const dbDialect = (process.env.DB_DIALECT || 'mysql') as 'mysql' | 'sqlite';
const dbStorage = process.env.DB_STORAGE || ':memory:';
const dbLogging = process.env.DB_LOGGING === 'true';

const sequelize =
  dbDialect === 'sqlite'
    ? new Sequelize({
        dialect: 'sqlite',
        storage: dbStorage,
        logging: dbLogging,
        // In-memory SQLite is fast but has no persistence across connections.
        // For file-based test DBs, foreign keys are enforced by default.
        define: {
          // Sequelize already handles this per-dialect; kept for clarity.
        },
      })
    : new Sequelize(dbName, dbUser, dbPass, {
        host: dbHost,
        dialect: 'mysql',
        logging: dbLogging,
        pool: {
          max: 20,
          min: 2,
          acquire: 60000,
          idle: 10000,
        },
      });

export default sequelize;
