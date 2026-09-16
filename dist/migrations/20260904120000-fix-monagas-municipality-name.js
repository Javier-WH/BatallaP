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
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Renombra el municipio "Monagas" (Anzoátegui) a su nombre oficial
 * "José Gregorio Monagas" en todas las tablas que almacenan municipios.
 *
 * Esto evita la colisión con "José Tadeo Monagas" (Guárico) en la lista
 * plana de municipios del Excel de inscripción masiva.
 */
exports.default = {
    up(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            const tables = [
                { table: 'person_residences', column: 'birth_municipality' },
                { table: 'person_residences', column: 'residence_municipality' },
                { table: 'student_previous_schools', column: 'municipality' },
                { table: 'planteles', column: 'municipality' },
            ];
            for (const { table, column } of tables) {
                yield queryInterface.sequelize.query(`UPDATE \`${table}\` SET \`${column}\` = 'José Gregorio Monagas' WHERE \`${column}\` = 'Monagas'`);
            }
        });
    },
    down(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            const tables = [
                { table: 'person_residences', column: 'birth_municipality' },
                { table: 'person_residences', column: 'residence_municipality' },
                { table: 'student_previous_schools', column: 'municipality' },
                { table: 'planteles', column: 'municipality' },
            ];
            for (const { table, column } of tables) {
                yield queryInterface.sequelize.query(`UPDATE \`${table}\` SET \`${column}\` = 'Monagas' WHERE \`${column}\` = 'José Gregorio Monagas'`);
            }
        });
    }
};
