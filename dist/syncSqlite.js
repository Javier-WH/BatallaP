"use strict";
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
const database_1 = __importDefault(require("./config/database.js"));
require("./models/index.js");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const sequelize_1 = require("sequelize");
(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield database_1.default.authenticate();
        console.log('✅ Conexión SQLite establecida.');
        yield database_1.default.sync({ force: true });
        console.log('✅ Tablas SQLite sincronizadas (force: true).');
        // Create SequelizeMeta table and mark all migrations as executed
        // so the migration runner in server.ts doesn't try to run MySQL-specific
        // migrations on SQLite.
        const queryInterface = database_1.default.getQueryInterface();
        const tableName = 'SequelizeMeta';
        const tableExists = yield queryInterface.tableExists(tableName);
        if (!tableExists) {
            yield queryInterface.createTable(tableName, {
                name: {
                    type: sequelize_1.DataTypes.STRING,
                    allowNull: false,
                    primaryKey: true,
                },
            });
        }
        const migrationsPath = path_1.default.join(__dirname, 'migrations');
        let migrationCount = 0;
        if (fs_1.default.existsSync(migrationsPath)) {
            const files = fs_1.default.readdirSync(migrationsPath)
                .filter(f => f.endsWith('.js') || f.endsWith('.ts'))
                .sort();
            for (const filename of files) {
                try {
                    yield queryInterface.bulkInsert(tableName, [{ name: filename }]);
                    migrationCount++;
                }
                catch (err) {
                    // Ignore duplicate errors
                    if (err.code !== 'SQLITE_CONSTRAINT') {
                        // ignore
                    }
                }
            }
        }
        console.log(`✅ ${migrationCount} migraciones marcadas como ejecutadas.`);
    }
    catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
    finally {
        try {
            yield database_1.default.close();
        }
        catch (_a) {
            /* ignore */
        }
    }
}))();
