import sequelize from '@/config/database';
import '@/models/index';
import fs from 'fs';
import path from 'path';
import { DataTypes } from 'sequelize';

(async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión SQLite establecida.');
    await sequelize.sync({ force: true });
    console.log('✅ Tablas SQLite sincronizadas (force: true).');

    // Create SequelizeMeta table and mark all migrations as executed
    // so the migration runner in server.ts doesn't try to run MySQL-specific
    // migrations on SQLite.
    const queryInterface = sequelize.getQueryInterface();
    const tableName = 'SequelizeMeta';
    const tableExists = await queryInterface.tableExists(tableName);
    if (!tableExists) {
      await queryInterface.createTable(tableName, {
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          primaryKey: true,
        },
      });
    }

    const migrationsPath = path.join(__dirname, 'migrations');
    let migrationCount = 0;
    if (fs.existsSync(migrationsPath)) {
      const files = fs.readdirSync(migrationsPath)
        .filter(f => f.endsWith('.js') || f.endsWith('.ts'))
        .sort();
      for (const filename of files) {
        try {
          await queryInterface.bulkInsert(tableName, [{ name: filename }]);
          migrationCount++;
        } catch (err: any) {
          // Ignore duplicate errors
          if (err.code !== 'SQLITE_CONSTRAINT') {
            // ignore
          }
        }
      }
    }
    console.log(`✅ ${migrationCount} migraciones marcadas como ejecutadas.`);

  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  } finally {
    try {
      await sequelize.close();
    } catch {
      /* ignore */
    }
  }
})();
