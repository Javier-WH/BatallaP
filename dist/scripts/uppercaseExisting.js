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
/**
 * uppercaseExisting.ts
 *
 * Script de normalización: convierte a mayúsculas los campos de texto
 * (nombres, apellidos, etc.) en los registros ya existentes de la BD.
 *
 * Ejecutar una sola vez:
 *   npx ts-node -r tsconfig-paths/register src/scripts/uppercaseExisting.ts
 */
const database_1 = __importDefault(require("../config/database.js"));
const updates = [
    {
        table: 'people',
        sets: [
            "firstName = UPPER(TRIM(firstName))",
            "lastName = UPPER(TRIM(lastName))",
            "pathology = UPPER(TRIM(pathology))",
            "livingWith = UPPER(TRIM(livingWith))",
        ],
    },
    {
        table: 'guardian_profiles',
        sets: [
            "firstName = UPPER(TRIM(firstName))",
            "lastName = UPPER(TRIM(lastName))",
            "occupation = UPPER(TRIM(occupation))",
            "residenceState = UPPER(TRIM(residenceState))",
            "residenceMunicipality = UPPER(TRIM(residenceMunicipality))",
            "residenceParish = UPPER(TRIM(residenceParish))",
            "address = UPPER(TRIM(address))",
        ],
    },
    {
        table: 'subjects',
        sets: [
            "name = UPPER(TRIM(name))",
            "abbreviation = UPPER(TRIM(abbreviation))",
        ],
    },
    {
        table: 'subject_groups',
        sets: ["name = UPPER(TRIM(name))"],
    },
    {
        table: 'grades',
        sets: ["name = UPPER(TRIM(name))"],
    },
    {
        table: 'sections',
        sets: ["name = UPPER(TRIM(name))"],
    },
    {
        table: 'specializations',
        sets: ["name = UPPER(TRIM(name))"],
    },
    {
        table: 'planteles',
        sets: [
            "name = UPPER(TRIM(name))",
            "state = UPPER(TRIM(state))",
            "dependency = UPPER(TRIM(dependency))",
            "municipality = UPPER(TRIM(municipality))",
            "parish = UPPER(TRIM(parish))",
        ],
    },
];
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        console.log('🔄 Iniciando normalización a mayúsculas...\n');
        yield database_1.default.authenticate();
        for (const { table, sets } of updates) {
            const setClause = sets.join(', ');
            const sql = `UPDATE \`${table}\` SET ${setClause}`;
            console.log(`  → ${table}`);
            const [result] = yield database_1.default.query(sql);
            const affected = (_b = (_a = result.affectedRows) !== null && _a !== void 0 ? _a : result.changedRows) !== null && _b !== void 0 ? _b : '?';
            console.log(`    Filas afectadas: ${affected}`);
        }
        console.log('\n✅ Normalización completada.');
        yield database_1.default.close();
    });
}
main().catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
});
