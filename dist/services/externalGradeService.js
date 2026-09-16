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
exports.registerExternalGradesBatch = exports.deleteExternalGrade = exports.listExternalGradesForPerson = exports.upsertExternalGrade = exports.createExternalInscription = exports.resolveOrCreateExternalPeriod = exports.resolveOrCreatePlantel = void 0;
const index_1 = require("../models/index.js");
const database_1 = __importDefault(require("../config/database.js"));
const gradeChangeLogService_1 = require("./gradeChangeLogService.js");
/**
 * Resolve a Plantel by code, or create it if not found.
 * Used to register external institutions that may not exist in the local catalog.
 */
const resolveOrCreatePlantel = (input, transaction) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f;
    if (input.code) {
        const existing = yield index_1.Plantel.findOne({ where: { code: input.code }, transaction });
        if (existing) {
            // Update name/state if provided and different (keep code as identity).
            const patch = {};
            if (input.name && input.name !== existing.name)
                patch.name = input.name;
            if (input.state && input.state !== existing.state)
                patch.state = input.state;
            if (input.dependency && input.dependency !== existing.dependency)
                patch.dependency = input.dependency;
            if (input.municipality && input.municipality !== existing.municipality)
                patch.municipality = input.municipality;
            if (input.parish && input.parish !== existing.parish)
                patch.parish = input.parish;
            if (Object.keys(patch).length > 0) {
                yield existing.update(patch, { transaction });
            }
            return existing;
        }
    }
    // Fallback: search by exact name + state to avoid duplicates when no code is provided.
    if (!input.code) {
        const byName = yield index_1.Plantel.findOne({
            where: { name: input.name, state: (_a = input.state) !== null && _a !== void 0 ? _a : '' },
            transaction,
        });
        if (byName)
            return byName;
    }
    return index_1.Plantel.create({
        code: (_b = input.code) !== null && _b !== void 0 ? _b : `EXT-${Date.now()}`,
        name: input.name,
        state: (_c = input.state) !== null && _c !== void 0 ? _c : '',
        dependency: (_d = input.dependency) !== null && _d !== void 0 ? _d : undefined,
        municipality: (_e = input.municipality) !== null && _e !== void 0 ? _e : undefined,
        parish: (_f = input.parish) !== null && _f !== void 0 ? _f : undefined,
    }, { transaction });
});
exports.resolveOrCreatePlantel = resolveOrCreatePlantel;
/**
 * Find or create an external SchoolPeriod representing the school year
 * of another institution. Marked with status = 'externo' so it is excluded
 * from normal academic management selectors.
 */
const resolveOrCreateExternalPeriod = (periodLabel, periodName, startYear, endYear, transaction) => __awaiter(void 0, void 0, void 0, function* () {
    const existing = yield index_1.SchoolPeriod.findOne({ where: { period: periodLabel }, transaction });
    if (existing)
        return existing;
    return index_1.SchoolPeriod.create({
        period: periodLabel,
        name: periodName,
        startYear,
        endYear,
        status: 'externo',
    }, { transaction });
});
exports.resolveOrCreateExternalPeriod = resolveOrCreateExternalPeriod;
/**
 * Create (or reuse) an Inscription for a student in an external period.
 * The inscription is marked with escolaridad = 'transferencia' so the
 * period closure engine skips it.
 */
const createExternalInscription = (input, transaction) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const person = yield index_1.Person.findByPk(input.personId, { transaction });
    if (!person)
        throw new Error('Estudiante no encontrado');
    const grade = yield index_1.Grade.findByPk(input.gradeId, { transaction });
    if (!grade)
        throw new Error('Grado no encontrado');
    const plantel = yield index_1.Plantel.findByPk(input.plantelId, { transaction });
    if (!plantel)
        throw new Error('Plantel no encontrado');
    const startYear = (_a = input.startYear) !== null && _a !== void 0 ? _a : (Number(input.periodLabel.split('-')[0]) || new Date().getFullYear());
    const endYear = (_b = input.endYear) !== null && _b !== void 0 ? _b : (Number(input.periodLabel.split('-')[1]) || startYear + 1);
    const period = yield (0, exports.resolveOrCreateExternalPeriod)(input.periodLabel, input.periodName, startYear, endYear, transaction);
    // Reuse existing inscription for this person + external period if it exists.
    const existing = yield index_1.Inscription.findOne({
        where: { personId: input.personId, schoolPeriodId: period.id },
        transaction,
    });
    if (existing)
        return existing;
    return index_1.Inscription.create({
        personId: input.personId,
        schoolPeriodId: period.id,
        gradeId: input.gradeId,
        sectionId: undefined,
        escolaridad: 'transferencia',
        isRepeater: false,
    }, { transaction });
});
exports.createExternalInscription = createExternalInscription;
/**
 * Upsert an external final grade for a subject within an external inscription.
 * The grade is stored directly (no recalculation) with the issuing institution
 * and the date from the original document.
 */
const upsertExternalGrade = (input, transaction) => __awaiter(void 0, void 0, void 0, function* () {
    const inscription = yield index_1.Inscription.findByPk(input.inscriptionId, { transaction });
    if (!inscription)
        throw new Error('Inscripción no encontrada');
    if (inscription.escolaridad !== 'transferencia') {
        throw new Error('La inscripción no es de tipo transferencia; use el flujo normal de calificación');
    }
    const subject = yield index_1.Subject.findByPk(input.subjectId, { transaction });
    if (!subject)
        throw new Error('Materia no encontrada');
    const plantel = yield index_1.Plantel.findByPk(input.plantelId, { transaction });
    if (!plantel)
        throw new Error('Plantel no encontrado');
    // Find or create the InscriptionSubject row.
    let insSub = yield index_1.InscriptionSubject.findOne({
        where: { inscriptionId: input.inscriptionId, subjectId: input.subjectId },
        transaction,
    });
    if (!insSub) {
        insSub = yield index_1.InscriptionSubject.create({
            inscriptionId: input.inscriptionId,
            subjectId: input.subjectId,
            schoolPeriodId: inscription.schoolPeriodId,
            gradeId: inscription.gradeId,
            sectionId: inscription.sectionId,
        }, { transaction });
    }
    const existing = yield index_1.SubjectFinalGrade.findOne({
        where: { inscriptionSubjectId: insSub.id, gradeType: input.gradeType },
        transaction,
    });
    if (existing) {
        const prevScore = existing.finalScore;
        const prevStatus = existing.status;
        // Only allow editing external grades; never downgrade a regular grade to external here.
        yield existing.update({
            finalScore: input.finalScore,
            status: input.status,
            plantelId: input.plantelId,
            calculatedAt: input.issuedAt,
            gradeType: input.gradeType,
            rawScore: null,
            councilPoints: 0,
        }, { transaction });
        if (input.editedBy) {
            yield (0, gradeChangeLogService_1.logGradeChange)({
                entityType: 'subject_final_grade',
                entityId: existing.id,
                previousScore: prevScore != null ? Number(prevScore) : null,
                newScore: input.finalScore,
                previousStatus: prevStatus || null,
                newStatus: input.status,
                gradeType: input.gradeType,
                editedBy: input.editedBy,
                editorRole: 'control_estudios',
                metadata: { inscriptionSubjectId: insSub.id, personId: inscription.personId, subjectId: input.subjectId, schoolPeriodId: inscription.schoolPeriodId, plantelId: input.plantelId, externalGrade: true },
            }, transaction);
        }
        return existing;
    }
    const newGrade = yield index_1.SubjectFinalGrade.create({
        inscriptionSubjectId: insSub.id,
        finalScore: input.finalScore,
        status: input.status,
        plantelId: input.plantelId,
        calculatedAt: input.issuedAt,
        gradeType: input.gradeType,
        rawScore: null,
        councilPoints: 0,
        schoolPeriodId: inscription.schoolPeriodId,
        subjectId: insSub.subjectId,
        gradeId: inscription.gradeId,
    }, { transaction });
    if (input.editedBy) {
        yield (0, gradeChangeLogService_1.logGradeChange)({
            entityType: 'subject_final_grade',
            entityId: newGrade.id,
            previousScore: null,
            newScore: input.finalScore,
            previousStatus: null,
            newStatus: input.status,
            gradeType: input.gradeType,
            editedBy: input.editedBy,
            editorRole: 'control_estudios',
            metadata: { inscriptionSubjectId: insSub.id, personId: inscription.personId, subjectId: input.subjectId, schoolPeriodId: inscription.schoolPeriodId, plantelId: input.plantelId, externalGrade: true },
        }, transaction);
    }
    return newGrade;
});
exports.upsertExternalGrade = upsertExternalGrade;
/**
 * List external grades for a person, grouped by external inscription/period.
 */
const listExternalGradesForPerson = (personId, transaction) => __awaiter(void 0, void 0, void 0, function* () {
    const inscriptions = yield index_1.Inscription.findAll({
        where: { personId, escolaridad: 'transferencia' },
        include: [
            { model: index_1.SchoolPeriod, as: 'period' },
            { model: index_1.Grade, as: 'grade' },
            {
                model: index_1.InscriptionSubject,
                as: 'inscriptionSubjects',
                include: [
                    { model: index_1.Subject, as: 'subject' },
                    { model: index_1.SubjectFinalGrade, as: 'finalGrade', include: [{ model: index_1.Plantel, as: 'plantel' }] },
                ],
            },
        ],
        order: [[{ model: index_1.SchoolPeriod, as: 'period' }, 'period', 'ASC']],
        transaction,
    });
    return inscriptions;
});
exports.listExternalGradesForPerson = listExternalGradesForPerson;
/**
 * Delete an external final grade. Refuses to delete non-external grades.
 */
const deleteExternalGrade = (subjectFinalGradeId, transaction) => __awaiter(void 0, void 0, void 0, function* () {
    const grade = yield index_1.SubjectFinalGrade.findByPk(subjectFinalGradeId, { transaction });
    if (!grade)
        throw new Error('Nota no encontrada');
    if (grade.gradeType !== 'transferencia' && grade.gradeType !== 'equivalencia') {
        throw new Error('Solo se pueden eliminar notas externas (transferencia/equivalencia)');
    }
    yield grade.destroy({ transaction });
});
exports.deleteExternalGrade = deleteExternalGrade;
/**
 * Orchestrate the full external enrollment + grade registration in a single transaction.
 * Useful for the bulk Excel flow.
 */
const registerExternalGradesBatch = (entries) => __awaiter(void 0, void 0, void 0, function* () {
    let created = 0;
    let skipped = 0;
    yield database_1.default.transaction((t) => __awaiter(void 0, void 0, void 0, function* () {
        for (const entry of entries) {
            const plantel = yield (0, exports.resolveOrCreatePlantel)(entry.plantel, t);
            const inscription = yield (0, exports.createExternalInscription)({
                personId: entry.personId,
                periodLabel: entry.periodLabel,
                periodName: entry.periodName,
                startYear: entry.startYear,
                endYear: entry.endYear,
                gradeId: entry.gradeId,
                plantelId: plantel.id,
            }, t);
            for (const g of entry.grades) {
                try {
                    yield (0, exports.upsertExternalGrade)({
                        inscriptionId: inscription.id,
                        subjectId: g.subjectId,
                        finalScore: g.finalScore,
                        status: g.status,
                        plantelId: plantel.id,
                        issuedAt: g.issuedAt,
                        gradeType: g.gradeType,
                    }, t);
                    created += 1;
                }
                catch (err) {
                    console.error('[ExternalGradeService] Error registering external grade:', err);
                    skipped += 1;
                }
            }
        }
    }));
    return { created, skipped };
});
exports.registerExternalGradesBatch = registerExternalGradesBatch;
