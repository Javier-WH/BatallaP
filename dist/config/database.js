"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: process.env.ENV_FILE || '.env' });
const dbName = process.env.DB_NAME || 'bp';
const dbUser = process.env.DB_USER || 'root';
const dbPass = process.env.DB_PASS || '';
const dbHost = process.env.DB_HOST || 'localhost';
const dbDialect = (process.env.DB_DIALECT || 'mysql');
const dbStorage = process.env.DB_STORAGE || ':memory:';
const dbLogging = process.env.DB_LOGGING === 'true';
const sequelize = dbDialect === 'sqlite'
    ? new sequelize_1.Sequelize({
        dialect: 'sqlite',
        storage: dbStorage,
        logging: dbLogging,
        // In-memory SQLite is fast but has no persistence across connections.
        // For file-based test DBs, foreign keys are enforced by default.
        define: {
        // Sequelize already handles this per-dialect; kept for clarity.
        },
    })
    : new sequelize_1.Sequelize(dbName, dbUser, dbPass, {
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
exports.default = sequelize;
