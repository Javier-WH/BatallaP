import sequelize from '@/config/database';
import fs from 'fs';
import path from 'path';
import { QueryInterface, DataTypes } from 'sequelize';

interface Migration {
  filename: string;
  up: (queryInterface: QueryInterface) => Promise<void>;
  down: (queryInterface: QueryInterface) => Promise<void>;
}

export class MigrationRunner {
  private migrationsPath: string;
  private queryInterface: QueryInterface;

  constructor() {
    this.migrationsPath = path.join(__dirname, '../migrations');
    this.queryInterface = sequelize.getQueryInterface();
  }

  private async loadMigration(filename: string): Promise<Migration | null> {
    const filePath = path.join(this.migrationsPath, filename);
    const fullPath = require.resolve(filePath);

    // Clear the require cache to ensure fresh load
    delete require.cache[fullPath];

    try {
      // Use dynamic import for ES6 modules
      const module = await import(fullPath);
      const migration = module.default || module;
      return { filename, ...migration };
    } catch (error) {
      console.error(`❌ Error loading migration ${filename}:`, error);
      return null;
    }
  }

  private async ensureMigrationTable(): Promise<void> {
    const tableName = 'SequelizeMeta';
    const tableExists = await this.queryInterface.tableExists(tableName);

    if (!tableExists) {
      await this.queryInterface.createTable(tableName, {
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          primaryKey: true,
        },
      });
      console.log('✅ Created SequelizeMeta table');
    }
  }

  private async getExecutedMigrations(): Promise<string[]> {
    const tableName = 'SequelizeMeta';
    const tableExists = await this.queryInterface.tableExists(tableName);

    if (!tableExists) {
      return [];
    }

    const [results] = await sequelize.query(
      `SELECT name FROM ${tableName} ORDER BY name`
    );

    return results.map((row: any) => row.name);
  }

  private getMigrationFiles(): string[] {
    if (!fs.existsSync(this.migrationsPath)) {
      return [];
    }

    const files = fs.readdirSync(this.migrationsPath);
    return files
      .filter(file => file.endsWith('.js') || file.endsWith('.ts'))
      .sort();
  }

  public async runMigrations(): Promise<void> {
    console.log('🔍 Checking for pending migrations...');

    await this.ensureMigrationTable();

    const executedMigrations = await this.getExecutedMigrations();
    const migrationFiles = this.getMigrationFiles();

    // Check if database already has tables (from sync())
    // Use dialect-appropriate query: MySQL uses "SHOW TABLES",
    // SQLite uses sqlite_master
    const isSqlite = sequelize.getDialect() === 'sqlite';
    const [tables] = isSqlite
      ? await sequelize.query(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        )
      : await sequelize.query("SHOW TABLES");
    const existingTables = tables.map((t: any) => Object.values(t)[0] as string);

    // If tables already exist and no migrations have been recorded,
    // mark all existing migration files as executed to avoid conflicts
    if (existingTables.length > 5 && executedMigrations.length === 0 && migrationFiles.length > 0) {
      console.log('⚠️ Database has existing tables but no migration records.');
      console.log('📝 Marking all migration files as executed to avoid conflicts...');
      for (const filename of migrationFiles) {
        try {
          await this.queryInterface.bulkInsert('SequelizeMeta', [{ name: filename }]);
        } catch (insertError: any) {
          // Ignore duplicate entry errors (MySQL: ER_DUP_ENTRY, SQLite: SQLITE_CONSTRAINT)
          if (insertError.code !== 'ER_DUP_ENTRY' && insertError.code !== 'SQLITE_CONSTRAINT') {
            console.error(`⚠️ Could not record migration: ${filename}`, insertError);
          }
        }
      }
      console.log('✅ Migration records synced with existing database state');
      return;
    }

    const pendingMigrations = migrationFiles.filter(
      file => !executedMigrations.includes(file)
    );

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }

    console.log(`📋 Found ${pendingMigrations.length} pending migration(s):`);
    pendingMigrations.forEach(file => console.log(`   - ${file}`));

    for (const filename of pendingMigrations) {
      console.log(`⏳ Running migration: ${filename}`);

      const migration = await this.loadMigration(filename);
      if (!migration) {
        console.error(`❌ Failed to load migration: ${filename}`);
        continue;
      }

      try {
        await migration.up(this.queryInterface);

        // Record the migration
        await this.queryInterface.bulkInsert('SequelizeMeta', [{ name: filename }]);

        console.log(`✅ Migration completed: ${filename}`);
      } catch (error: any) {
        // Check if the error is about duplicate keys/tables/columns (already exists)
        // Support both MySQL error codes (ER_*) and SQLite error codes (SQLITE_*)
        const errorCode = error.code || error.parent?.code;
        const isDuplicateError =
          errorCode === 'ER_DUP_KEYNAME' ||
          errorCode === 'ER_TABLE_EXISTS_ERROR' ||
          errorCode === 'ER_DUP_FIELDNAME' ||
          errorCode === 'ER_DUP_ENTRY' ||
          errorCode === 'ER_BAD_FIELD_ERROR' ||
          errorCode === 'ER_CANT_DROP_FIELD_OR_KEY' ||
          errorCode === 'ER_BAD_NULL_ERROR' ||
          errorCode === 'SQLITE_CONSTRAINT';
        if (isDuplicateError) {
          console.log(`⚠️ Migration skipped (already exists): ${filename}`);
          // Still record the migration as executed
          try {
            await this.queryInterface.bulkInsert('SequelizeMeta', [{ name: filename }]);
          } catch (insertError: any) {
            // Ignore if already recorded (MySQL: ER_DUP_ENTRY, SQLite: SQLITE_CONSTRAINT)
            if (insertError.code !== 'ER_DUP_ENTRY' && insertError.code !== 'SQLITE_CONSTRAINT') {
              console.error(`⚠️ Could not record migration: ${filename}`, insertError);
            }
          }
          continue;
        }
        console.error(`❌ Migration failed: ${filename}`, error);
        throw error;
      }
    }

    console.log('✅ All migrations completed successfully');
  }

  public async rollbackLastMigration(): Promise<void> {
    console.log('🔄 Rolling back last migration...');

    await this.ensureMigrationTable();

    const executedMigrations = await this.getExecutedMigrations();

    if (executedMigrations.length === 0) {
      console.log('❌ No migrations to rollback');
      return;
    }

    const lastMigration = executedMigrations[executedMigrations.length - 1];
    console.log(`⏳ Rolling back: ${lastMigration}`);

    const migration = await this.loadMigration(lastMigration);
    if (!migration) {
      console.error(`❌ Failed to load migration: ${lastMigration}`);
      return;
    }

    try {
      await sequelize.transaction(async (t) => {
        const queryInterfaceWithTransaction = sequelize.getQueryInterface();
        await migration.down(queryInterfaceWithTransaction);

        // Remove the migration record
        await this.queryInterface.bulkDelete(
          'SequelizeMeta',
          { name: lastMigration },
          { transaction: t }
        );
      });

      console.log(`✅ Rollback completed: ${lastMigration}`);
    } catch (error) {
      console.error(`❌ Rollback failed: ${lastMigration}`, error);
      throw error;
    }
  }
}

export default MigrationRunner;
