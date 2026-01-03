import { Sequelize } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import sequelize from './config/database'; // Adjust path if needed
import path from 'path';

const runMigration = async () => {
  const umzug = new Umzug({
    migrations: {
      glob: path.join(__dirname, 'migrations/*.ts'),
      resolve: ({ name, path: migrationPath, context }) => {
        // Adjust depending on how your migrations are exported
        const migration = require(migrationPath as string);
        return {
          name,
          up: async () => migration.default.up(context),
          down: async () => migration.default.down(context),
        };
      },
    },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
  });

  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Explicitly run the new migration file
    // Filter to only run the new one if we want to be safe, or just 'up' which runs pending.
    // Given the previous usage, 'up' is likely fine.
    await umzug.up();

    console.log('Migration executed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
};

runMigration();
