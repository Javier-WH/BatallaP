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
exports.activatePeriod = exports.ensureNextPreinscriptionPeriod = exports.clonePeriodStructure = exports.buildNextPeriodDescriptor = exports.getPreinscriptionPeriod = exports.getActivePeriod = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const index_1 = require("../models/index.js");
const getActivePeriod = (transaction) => __awaiter(void 0, void 0, void 0, function* () { return index_1.SchoolPeriod.findOne({ where: { status: 'activo' }, transaction }); });
exports.getActivePeriod = getActivePeriod;
const getPreinscriptionPeriod = (transaction) => __awaiter(void 0, void 0, void 0, function* () { return index_1.SchoolPeriod.findOne({ where: { status: 'preinscripcion' }, transaction }); });
exports.getPreinscriptionPeriod = getPreinscriptionPeriod;
/**
 * Build the descriptor of the school year right after the given one.
 * "2025-2026" -> "2026-2027".
 */
const buildNextPeriodDescriptor = (period) => {
    const startYear = period.startYear + 1;
    const endYear = period.endYear + 1;
    const label = `${startYear}-${endYear}`;
    return {
        period: label,
        name: `Año Escolar ${label}`,
        startYear,
        endYear,
    };
};
exports.buildNextPeriodDescriptor = buildNextPeriodDescriptor;
/**
 * Copy the academic structure (terms, grades, sections, subjects and teacher
 * assignments) from one period into another. Merge semantics: existing rows in
 * the target period are reused and only missing pieces are created, so it is
 * safe to call on a partially configured period. Nothing is deleted here.
 */
const clonePeriodStructure = (sourcePeriodId, targetPeriodId, transaction) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const existingTerms = yield index_1.Term.count({
        where: { schoolPeriodId: targetPeriodId },
        transaction,
    });
    const sourceTerms = existingTerms > 0
        ? []
        : yield index_1.Term.findAll({
            where: { schoolPeriodId: sourcePeriodId },
            order: [['order', 'ASC']],
            transaction,
        });
    for (const term of sourceTerms) {
        yield index_1.Term.create({
            schoolPeriodId: targetPeriodId,
            name: term.name,
            order: term.order,
            isBlocked: false,
            isActive: false,
        }, { transaction });
    }
    const sourcePeriodGrades = yield index_1.PeriodGrade.findAll({
        where: { schoolPeriodId: sourcePeriodId },
        transaction,
    });
    const periodGradeSubjectIdMap = new Map();
    for (const pg of sourcePeriodGrades) {
        const [newPeriodGrade] = yield index_1.PeriodGrade.findOrCreate({
            where: {
                schoolPeriodId: targetPeriodId,
                gradeId: pg.gradeId,
                specializationId: (_a = pg.specializationId) !== null && _a !== void 0 ? _a : null,
            },
            defaults: {
                schoolPeriodId: targetPeriodId,
                gradeId: pg.gradeId,
                specializationId: pg.specializationId,
                color: pg.color,
            },
            transaction,
        });
        const sourceSections = yield index_1.PeriodGradeSection.findAll({
            where: { periodGradeId: pg.id },
            transaction,
        });
        for (const pgs of sourceSections) {
            yield index_1.PeriodGradeSection.findOrCreate({
                where: {
                    periodGradeId: newPeriodGrade.id,
                    sectionId: pgs.sectionId,
                },
                defaults: {
                    periodGradeId: newPeriodGrade.id,
                    sectionId: pgs.sectionId,
                    color: pgs.color,
                },
                transaction,
            });
        }
        const sourceSubjects = yield index_1.PeriodGradeSubject.findAll({
            where: { periodGradeId: pg.id },
            transaction,
        });
        for (const pgSubject of sourceSubjects) {
            // Unscoped: an inactive link in the target must still be found, otherwise
            // create() would violate the (periodGradeId, subjectId) unique index.
            const [newPeriodGradeSubject] = yield index_1.PeriodGradeSubject.unscoped().findOrCreate({
                where: {
                    periodGradeId: newPeriodGrade.id,
                    subjectId: pgSubject.subjectId,
                },
                defaults: {
                    periodGradeId: newPeriodGrade.id,
                    subjectId: pgSubject.subjectId,
                    order: pgSubject.order,
                    active: pgSubject.active,
                    includeInAverage: pgSubject.includeInAverage,
                    notRepairable: pgSubject.notRepairable,
                    weeklyBlocks: pgSubject.weeklyBlocks,
                },
                transaction,
            });
            periodGradeSubjectIdMap.set(pgSubject.id, newPeriodGradeSubject.id);
        }
    }
    if (periodGradeSubjectIdMap.size === 0)
        return;
    const sourceAssignments = yield index_1.TeacherAssignment.findAll({
        where: {
            periodGradeSubjectId: { [sequelize_1.Op.in]: Array.from(periodGradeSubjectIdMap.keys()) },
        },
        transaction,
    });
    for (const assignment of sourceAssignments) {
        const newPeriodGradeSubjectId = periodGradeSubjectIdMap.get(assignment.periodGradeSubjectId);
        if (!newPeriodGradeSubjectId)
            continue;
        yield index_1.TeacherAssignment.findOrCreate({
            where: {
                periodGradeSubjectId: newPeriodGradeSubjectId,
                sectionId: assignment.sectionId,
            },
            defaults: {
                teacherId: assignment.teacherId,
                periodGradeSubjectId: newPeriodGradeSubjectId,
                sectionId: assignment.sectionId,
            },
            transaction,
        });
    }
});
exports.clonePeriodStructure = clonePeriodStructure;
/**
 * Guarantee that the school year following the active one exists and is flagged
 * as 'preinscripcion', so students can enroll for the next year before the
 * current one ends. Idempotent: does nothing when the next period already exists.
 */
const ensureNextPreinscriptionPeriod = (activePeriod, transaction) => __awaiter(void 0, void 0, void 0, function* () {
    const descriptor = (0, exports.buildNextPeriodDescriptor)(activePeriod);
    const existing = yield index_1.SchoolPeriod.findOne({
        where: {
            status: { [sequelize_1.Op.ne]: 'externo' },
            startYear: descriptor.startYear,
        },
        transaction,
    });
    if (existing) {
        // Normalize an already created future period that was left as 'historico'
        if (existing.status === 'historico') {
            yield existing.update({ status: 'preinscripcion' }, { transaction });
        }
        // Backfill the structure when the period was created before the active one had any
        const structureCount = yield index_1.PeriodGrade.count({
            where: { schoolPeriodId: existing.id },
            transaction,
        });
        if (structureCount === 0) {
            yield (0, exports.clonePeriodStructure)(activePeriod.id, existing.id, transaction);
        }
        return existing;
    }
    const created = yield index_1.SchoolPeriod.create({
        period: descriptor.period,
        name: descriptor.name,
        startYear: descriptor.startYear,
        endYear: descriptor.endYear,
        status: 'preinscripcion',
    }, { transaction });
    yield (0, exports.clonePeriodStructure)(activePeriod.id, created.id, transaction);
    return created;
});
exports.ensureNextPreinscriptionPeriod = ensureNextPreinscriptionPeriod;
/**
 * Make the given period the active one. Demotes the previous active period to
 * 'historico', keeps at most one 'preinscripcion' and creates the following
 * school year when it does not exist yet.
 */
const activatePeriod = (periodId, externalTransaction) => __awaiter(void 0, void 0, void 0, function* () {
    const transaction = externalTransaction !== null && externalTransaction !== void 0 ? externalTransaction : (yield database_1.default.transaction());
    const ownsTransaction = !externalTransaction;
    try {
        const target = yield index_1.SchoolPeriod.findByPk(periodId, { transaction });
        if (!target)
            throw new Error('Período escolar no encontrado');
        if (target.status === 'externo') {
            throw new Error('No se puede activar un período externo');
        }
        yield index_1.SchoolPeriod.update({ status: 'historico' }, {
            where: {
                status: { [sequelize_1.Op.in]: ['activo', 'preinscripcion'] },
                id: { [sequelize_1.Op.ne]: target.id },
            },
            transaction,
        });
        yield target.update({ status: 'activo' }, { transaction });
        yield (0, exports.ensureNextPreinscriptionPeriod)(target, transaction);
        if (ownsTransaction)
            yield transaction.commit();
        return target;
    }
    catch (error) {
        if (ownsTransaction)
            yield transaction.rollback();
        throw error;
    }
});
exports.activatePeriod = activatePeriod;
