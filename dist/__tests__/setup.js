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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../config/database.js"));
require("../models/index.js");
const app_1 = require("../app.js");
const isSqlite = ((_a = database_1.default.options) === null || _a === void 0 ? void 0 : _a.dialectName) === 'sqlite' ||
    (database_1.default.getDialect && database_1.default.getDialect() === 'sqlite');
// Disable logging for tests
database_1.default.options.logging = false;
beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield database_1.default.authenticate();
        // In-memory SQLite starts empty: create all tables from the Sequelize models.
        // For MySQL we rely on the existing schema (no sync here).
        if (isSqlite) {
            yield database_1.default.sync({ force: true });
            // Ensure the session store table exists (connect-session-sequelize syncs
            // asynchronously in its constructor, which may not have completed yet).
            const sessionModel = app_1.sessionStore.sessionModel;
            if (sessionModel && typeof sessionModel.sync === 'function') {
                yield sessionModel.sync({ force: true });
            }
        }
        console.log(`Test database connected (dialect=${database_1.default.getDialect()})`);
    }
    catch (error) {
        console.error('Unable to connect to test database:', error);
        throw error;
    }
}));
afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield database_1.default.close();
        console.log('Test database connection closed');
    }
    catch (error) {
        console.error('Error closing test database:', error);
    }
}));
beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
    // Truncate all tables before each test, dialect-aware.
    try {
        if (isSqlite) {
            // SQLite: disable FK enforcement during cleanup, then delete rows.
            yield database_1.default.query('PRAGMA foreign_keys = OFF');
            const modelNames = Object.keys(database_1.default.models);
            const tableNames = modelNames.map((name) => {
                const model = database_1.default.models[name];
                const tableName = model.getTableName();
                return typeof tableName === 'string' ? tableName : name;
            });
            for (const table of tableNames) {
                yield database_1.default.query(`DELETE FROM "${table}"`);
            }
            // Reset autoincrement sequences for SQLite.
            for (const table of tableNames) {
                try {
                    yield database_1.default.query(`DELETE FROM sqlite_sequence WHERE name = '${table}'`);
                }
                catch (_a) {
                    // sqlite_sequence only exists after the first AUTOINCREMENT insert.
                }
            }
            yield database_1.default.query('PRAGMA foreign_keys = ON');
        }
        else {
            yield database_1.default.query('SET FOREIGN_KEY_CHECKS = 0');
            const tables = Object.keys(database_1.default.models);
            for (const table of tables) {
                yield database_1.default.models[table].destroy({
                    where: {},
                    truncate: true,
                    cascade: true,
                });
            }
            yield database_1.default.query('SET FOREIGN_KEY_CHECKS = 1');
        }
    }
    catch (error) {
        console.error('Error cleaning database:', error);
    }
}));
