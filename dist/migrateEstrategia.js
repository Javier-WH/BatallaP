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
const sequelize_1 = require("sequelize");
(() => __awaiter(void 0, void 0, void 0, function* () {
    yield database_1.default.authenticate();
    // 1. Expand the ENUM to include 'estrategia'
    try {
        yield database_1.default.query("ALTER TABLE evaluation_catalogs MODIFY COLUMN type ENUM('tecnica','instrumento','estrategia') NOT NULL");
        console.log('ENUM expanded with estrategia');
    }
    catch (e) {
        console.log('ENUM alter skipped:', e.message);
    }
    // 2. Add estrategiaId column to evaluation_plans
    try {
        yield database_1.default.query("ALTER TABLE evaluation_plans ADD COLUMN estrategiaId INT NULL DEFAULT NULL");
        console.log('Column estrategiaId added to evaluation_plans');
    }
    catch (e) {
        console.log('Column add skipped (may already exist):', e.message);
    }
    // 3. Migrate existing description values to evaluation_catalogs
    const rows = yield database_1.default.query("SELECT DISTINCT description FROM evaluation_plans WHERE description IS NOT NULL AND description != '' AND estrategiaId IS NULL", { type: sequelize_1.QueryTypes.SELECT });
    for (const row of rows) {
        const name = row.description;
        const existing = yield database_1.default.query("SELECT id FROM evaluation_catalogs WHERE type='estrategia' AND name=?", { replacements: [name], type: sequelize_1.QueryTypes.SELECT });
        let catalogId;
        if (existing.length > 0) {
            catalogId = existing[0].id;
        }
        else {
            const result = yield database_1.default.query("INSERT INTO evaluation_catalogs (type, name) VALUES ('estrategia', ?)", { replacements: [name], type: sequelize_1.QueryTypes.INSERT });
            catalogId = result[0];
        }
        yield database_1.default.query("UPDATE evaluation_plans SET estrategiaId=? WHERE description=?", { replacements: [catalogId, name] });
        console.log(`Migrated estrategia "${name}" -> ID ${catalogId}`);
    }
    console.log('Migration complete');
    yield database_1.default.close();
}))();
