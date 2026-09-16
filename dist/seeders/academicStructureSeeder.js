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
const schoolPeriodService_1 = require("../services/schoolPeriodService.js");
const SECTION_SUFFIXES = ['A', 'B'];
const GRADE_SUBJECTS = {
    1: [
        'Arte y Patrimonio',
        'Castellano',
        'Ciencias Naturales',
        'Educación Física',
        'Geografía, Historia y Ciudadanía',
        'Inglés y otras Lenguas Extranjeras',
        'Matemáticas',
        'Orientación y Convivencia',
        'Artes Gráficas',
        'Redacción y Ortografía'
    ],
    2: [
        'Arte y Patrimonio',
        'Castellano',
        'Ciencias Naturales',
        'Educación Física',
        'Geografía, Historia y Ciudadanía',
        'Inglés y otras Lenguas Extranjeras',
        'Matemáticas',
        'Orientación y Convivencia',
        'Artes Gráficas',
        'Redacción y Ortografía'
    ],
    3: [
        'Castellano',
        'Biología',
        'Física',
        'Química',
        'Educación Física',
        'Geografía, Historia y Ciudadanía',
        'Inglés y otras Lenguas Extranjeras',
        'Matemáticas',
        'Orientación y Convivencia',
        'Artes Gráficas',
        'Ecología'
    ],
    4: [
        'Castellano',
        'Biología',
        'Física',
        'Química',
        'Educación Física',
        'Formación para la Soberanía Nacional',
        'Geografía, Historia y Ciudadanía',
        'Inglés y otras Lenguas Extranjeras',
        'Matemáticas',
        'Orientación y Convivencia',
        'Artes Gráficas',
        'Agrupación de Desfile'
    ],
    5: [
        'Castellano',
        'Biología',
        'Física',
        'Química',
        'Ciencias de la Tierra',
        'Educación Física',
        'Formación para la Soberanía Nacional',
        'Geografía, Historia y Ciudadanía',
        'Inglés y otras Lenguas Extranjeras',
        'Matemáticas',
        'Orientación y Convivencia',
        'Artes Gráficas',
        'Agrupación de Desfile'
    ]
};
const ensureSectionsForGrade = (grade, transaction) => __awaiter(void 0, void 0, void 0, function* () {
    const sectionRecords = [];
    for (const suffix of SECTION_SUFFIXES) {
        const name = `Sección ${suffix}`.toUpperCase().trim();
        const [section] = yield index_1.Section.findOrCreate({
            where: { name },
            defaults: { name },
            transaction
        });
        sectionRecords.push(section);
    }
    return sectionRecords;
});
const ensurePeriodGrade = (schoolPeriodId, gradeId, transaction) => __awaiter(void 0, void 0, void 0, function* () {
    const [periodGrade] = yield index_1.PeriodGrade.findOrCreate({
        where: { schoolPeriodId, gradeId },
        defaults: { schoolPeriodId, gradeId },
        transaction
    });
    return periodGrade;
});
const assignSectionsToPeriodGrade = (periodGradeId, sections, transaction) => __awaiter(void 0, void 0, void 0, function* () {
    for (const section of sections) {
        yield index_1.PeriodGradeSection.findOrCreate({
            where: { periodGradeId, sectionId: section.id },
            defaults: { periodGradeId, sectionId: section.id },
            transaction
        });
    }
});
const assignSubjectsToPeriodGrade = (periodGradeId, subjects, transaction) => __awaiter(void 0, void 0, void 0, function* () {
    let order = 1;
    for (const subject of subjects) {
        yield index_1.PeriodGradeSubject.findOrCreate({
            where: { periodGradeId, subjectId: subject.id },
            defaults: { periodGradeId, subjectId: subject.id, order },
            transaction
        });
        order += 1;
    }
});
const ensurePensumSubjects = (transaction) => __awaiter(void 0, void 0, void 0, function* () {
    const uniqueNames = new Set(Object.values(GRADE_SUBJECTS).flat());
    const subjectsMap = new Map();
    for (const name of uniqueNames) {
        // Normalize to uppercase to match the model's beforeSave hook,
        // which converts names to uppercase. This ensures findOrCreate works
        // correctly on case-sensitive databases like SQLite.
        const normalizedName = name.toUpperCase().trim();
        const [subject] = yield index_1.Subject.findOrCreate({
            where: { name: normalizedName },
            defaults: { name: normalizedName },
            transaction
        });
        subjectsMap.set(name, subject);
    }
    return subjectsMap;
});
const seedAcademicStructure = () => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const transaction = yield database_1.default.transaction();
    try {
        const activePeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' }, transaction });
        if (!activePeriod) {
            throw new Error('No existe un período escolar activo. Ejecute el seeder principal primero.');
        }
        const grades = yield index_1.Grade.findAll({ order: [['order', 'ASC']], transaction });
        if (!grades.length) {
            throw new Error('No se encontraron grados. Ejecute el seeder principal primero.');
        }
        const subjectMap = yield ensurePensumSubjects(transaction);
        let structuresCreated = 0;
        for (const grade of grades) {
            const gradeOrder = (_a = grade.order) !== null && _a !== void 0 ? _a : grade.id;
            const subjectNames = (_b = GRADE_SUBJECTS[gradeOrder]) !== null && _b !== void 0 ? _b : [];
            const periodGrade = yield ensurePeriodGrade(activePeriod.id, grade.id, transaction);
            const sections = yield ensureSectionsForGrade(grade, transaction);
            yield assignSectionsToPeriodGrade(periodGrade.id, sections, transaction);
            if (subjectNames.length > 0) {
                const subjects = subjectNames.map(name => {
                    const subject = subjectMap.get(name);
                    if (!subject) {
                        throw new Error(`La materia "${name}" no existe y no pudo ser creada.`);
                    }
                    return subject;
                });
                yield assignSubjectsToPeriodGrade(periodGrade.id, subjects, transaction);
            }
            else {
                console.warn(`⚠️ No hay pensum definido para ${grade.name}. Solo se asignaron secciones.`);
            }
            structuresCreated += 1;
        }
        // Mirror the structure into the preinscription period so students can enroll
        // for the next school year before the current one ends
        yield (0, schoolPeriodService_1.ensureNextPreinscriptionPeriod)(activePeriod, transaction);
        yield transaction.commit();
        console.log(`✅ Estructura académica configurada para ${structuresCreated} grados.`);
    }
    catch (error) {
        yield transaction.rollback();
        console.error('❌ Error configurando estructura académica:', error);
        throw error;
    }
});
if (require.main === module) {
    database_1.default.authenticate()
        .then(() => seedAcademicStructure())
        .then(() => process.exit(0))
        .catch(error => {
        console.error(error);
        process.exit(1);
    });
}
exports.default = seedAcademicStructure;
