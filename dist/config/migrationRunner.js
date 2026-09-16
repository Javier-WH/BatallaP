"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationRunner = void 0;
const database_1 = __importDefault(require("./database.js"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sequelize_1 = require("sequelize");
class MigrationRunner {
    constructor() {
        this.migrationsPath = path_1.default.join(__dirname, '../migrations');
        this.queryInterface = database_1.default.getQueryInterface();
    }
    loadMigration(filename) {
        return __awaiter(this, void 0, void 0, function* () {
            const filePath = path_1.default.join(this.migrationsPath, filename);
            const fullPath = require.resolve(filePath);
            // Clear the require cache to ensure fresh load
            delete require.cache[fullPath];
            try {
                // Use dynamic import for ES6 modules
                const module = yield Promise.resolve(`${fullPath}`).then(s => __importStar(require(s)));
                const migration = module.default || module;
                return Object.assign({ filename }, migration);
            }
            catch (error) {
                console.error(`❌ Error loading migration ${filename}:`, error);
                return null;
            }
        });
    }
    ensureMigrationTable() {
        return __awaiter(this, void 0, void 0, function* () {
            const tableName = 'SequelizeMeta';
            const tableExists = yield this.queryInterface.tableExists(tableName);
            if (!tableExists) {
                yield this.queryInterface.createTable(tableName, {
                    name: {
                        type: sequelize_1.DataTypes.STRING,
                        allowNull: false,
                        primaryKey: true,
                    },
                });
                console.log('✅ Created SequelizeMeta table');
            }
        });
    }
    getExecutedMigrations() {
        return __awaiter(this, void 0, void 0, function* () {
            const tableName = 'SequelizeMeta';
            const tableExists = yield this.queryInterface.tableExists(tableName);
            if (!tableExists) {
                return [];
            }
            const [results] = yield database_1.default.query(`SELECT name FROM ${tableName} ORDER BY name`);
            return results.map((row) => row.name);
        });
    }
    getMigrationFiles() {
        if (!fs_1.default.existsSync(this.migrationsPath)) {
            return [];
        }
        const files = fs_1.default.readdirSync(this.migrationsPath);
        return files
            .filter(file => file.endsWith('.js') || file.endsWith('.ts'))
            .sort();
    }
    runMigrations() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            console.log('🔍 Checking for pending migrations...');
            yield this.ensureMigrationTable();
            const executedMigrations = yield this.getExecutedMigrations();
            const migrationFiles = this.getMigrationFiles();
            // Check if database already has tables (from sync())
            // Use dialect-appropriate query: MySQL uses "SHOW TABLES",
            // SQLite uses sqlite_master
            const isSqlite = database_1.default.getDialect() === 'sqlite';
            const [tables] = isSqlite
                ? yield database_1.default.query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
                : yield database_1.default.query("SHOW TABLES");
            const existingTables = tables.map((t) => Object.values(t)[0]);
            // If tables already exist and no migrations have been recorded,
            // mark all existing migration files as executed to avoid conflicts
            if (existingTables.length > 5 && executedMigrations.length === 0 && migrationFiles.length > 0) {
                console.log('⚠️ Database has existing tables but no migration records.');
                console.log('📝 Marking all migration files as executed to avoid conflicts...');
                for (const filename of migrationFiles) {
                    try {
                        yield this.queryInterface.bulkInsert('SequelizeMeta', [{ name: filename }]);
                    }
                    catch (insertError) {
                        // Ignore duplicate entry errors (MySQL: ER_DUP_ENTRY, SQLite: SQLITE_CONSTRAINT)
                        if (insertError.code !== 'ER_DUP_ENTRY' && insertError.code !== 'SQLITE_CONSTRAINT') {
                            console.error(`⚠️ Could not record migration: ${filename}`, insertError);
                        }
                    }
                }
                console.log('✅ Migration records synced with existing database state');
                return;
            }
            const pendingMigrations = migrationFiles.filter(file => !executedMigrations.includes(file));
            if (pendingMigrations.length === 0) {
                console.log('✅ No pending migrations');
                return;
            }
            console.log(`📋 Found ${pendingMigrations.length} pending migration(s):`);
            pendingMigrations.forEach(file => console.log(`   - ${file}`));
            for (const filename of pendingMigrations) {
                console.log(`⏳ Running migration: ${filename}`);
                const migration = yield this.loadMigration(filename);
                if (!migration) {
                    console.error(`❌ Failed to load migration: ${filename}`);
                    continue;
                }
                try {
                    yield migration.up(this.queryInterface);
                    // Record the migration
                    yield this.queryInterface.bulkInsert('SequelizeMeta', [{ name: filename }]);
                    console.log(`✅ Migration completed: ${filename}`);
                }
                catch (error) {
                    // Check if the error is about duplicate keys/tables/columns (already exists)
                    // Support both MySQL error codes (ER_*) and SQLite error codes (SQLITE_*)
                    const errorCode = error.code || ((_a = error.parent) === null || _a === void 0 ? void 0 : _a.code);
                    const isDuplicateError = errorCode === 'ER_DUP_KEYNAME' ||
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
                            yield this.queryInterface.bulkInsert('SequelizeMeta', [{ name: filename }]);
                        }
                        catch (insertError) {
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
        });
    }
    rollbackLastMigration() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔄 Rolling back last migration...');
            yield this.ensureMigrationTable();
            const executedMigrations = yield this.getExecutedMigrations();
            if (executedMigrations.length === 0) {
                console.log('❌ No migrations to rollback');
                return;
            }
            const lastMigration = executedMigrations[executedMigrations.length - 1];
            console.log(`⏳ Rolling back: ${lastMigration}`);
            const migration = yield this.loadMigration(lastMigration);
            if (!migration) {
                console.error(`❌ Failed to load migration: ${lastMigration}`);
                return;
            }
            try {
                yield database_1.default.transaction((t) => __awaiter(this, void 0, void 0, function* () {
                    const queryInterfaceWithTransaction = database_1.default.getQueryInterface();
                    yield migration.down(queryInterfaceWithTransaction);
                    // Remove the migration record
                    yield this.queryInterface.bulkDelete('SequelizeMeta', { name: lastMigration }, { transaction: t });
                }));
                console.log(`✅ Rollback completed: ${lastMigration}`);
            }
            catch (error) {
                console.error(`❌ Rollback failed: ${lastMigration}`, error);
                throw error;
            }
        });
    }
}
exports.MigrationRunner = MigrationRunner;
exports.default = MigrationRunner;
