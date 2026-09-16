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
const database_1 = __importDefault(require("../config/database.js"));
const index_1 = require("../models/index.js");
const GROUP_NAME = 'Participación en Grupos de Creación, Recreación y Producción';
const SUBJECTS_IN_GROUP = ['Artes Gráficas', 'Ortografía', 'Agrupación de Desfiles'];
const seedSubjectGroups = () => __awaiter(void 0, void 0, void 0, function* () {
    const transaction = yield database_1.default.transaction();
    try {
        const normalizedName = GROUP_NAME.toUpperCase().trim();
        const [group] = yield index_1.SubjectGroup.findOrCreate({
            where: { name: normalizedName },
            defaults: { name: normalizedName },
            transaction
        });
        for (const subjectName of SUBJECTS_IN_GROUP) {
            const normalizedSubject = subjectName.toUpperCase().trim();
            const [subject] = yield index_1.Subject.findOrCreate({
                where: { name: normalizedSubject },
                defaults: { name: normalizedSubject },
                transaction
            });
            if (subject.subjectGroupId !== group.id) {
                subject.subjectGroupId = group.id;
                yield subject.save({ transaction });
            }
        }
        yield transaction.commit();
        console.log(`✅ Grupo "${GROUP_NAME}" asignado a ${SUBJECTS_IN_GROUP.length} materias.`);
    }
    catch (error) {
        yield transaction.rollback();
        console.error('❌ Error configurando grupos de materias:', error);
        throw error;
    }
});
if (require.main === module) {
    database_1.default.authenticate()
        .then(() => seedSubjectGroups())
        .then(() => process.exit(0))
        .catch(error => {
        console.error(error);
        process.exit(1);
    });
}
exports.default = seedSubjectGroups;
