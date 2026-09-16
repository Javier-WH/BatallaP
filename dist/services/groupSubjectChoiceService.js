"use strict";
/**
 * Synchronizes `InscriptionGroupTermChoice` records — the per-term mapping of
 * which subject (within a SubjectGroup) a student is taking.
 *
 * Responsibilities:
 *  - `seedChoicesForInscription`: backfill choice records for an inscription
 *    based on its current InscriptionSubject rows. Used by the migration and
 *    by the enrollment flow so that new students get choice records for every
 *    term of their period.
 *  - `changeGroupSubjectFromTerm`: switch a student's group subject starting
 *    at a given term. Preserves notes in earlier terms; optionally destroys
 *    notes in the starting term when the student is switching mid-lapso.
 *  - `setGroupSubjectForTerm`: explicitly set the subject for a single term
 *    (backfill UI).
 */
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
exports.seedChoicesForInscription = seedChoicesForInscription;
exports.changeGroupSubjectFromTerm = changeGroupSubjectFromTerm;
exports.setGroupSubjectForTerm = setGroupSubjectForTerm;
exports.seedChoicesForPeriod = seedChoicesForPeriod;
const database_1 = __importDefault(require("../config/database.js"));
const index_1 = require("../models/index.js");
/**
 * For a given inscription, ensure every (group, term) pair has a choice record
 * pointing to the subject the student is currently enrolled in for that group.
 *
 * When the student has multiple InscriptionSubject rows for the same group
 * (legacy data from before the per-term feature), the one with qualifications
 * wins; ties go to the first row. This makes the migration non-breaking.
 *
 * Terms are scoped to the inscription's schoolPeriodId.
 */
function seedChoicesForInscription(inscriptionId_1) {
    return __awaiter(this, arguments, void 0, function* (inscriptionId, options = {}) {
        var _a;
        const { transaction: t = yield database_1.default.transaction() } = options;
        const ownTransaction = !options.transaction;
        try {
            const inscription = yield index_1.Inscription.findByPk(inscriptionId, { transaction: t });
            if (!inscription)
                return;
            const terms = yield index_1.Term.findAll({
                where: { schoolPeriodId: inscription.schoolPeriodId },
                order: [['order', 'ASC']],
                transaction: t,
            });
            if (terms.length === 0)
                return;
            const inscriptionSubjects = yield index_1.InscriptionSubject.findAll({
                where: { inscriptionId },
                include: [{ model: index_1.Subject, as: 'subject' }],
                attributes: ['id', 'inscriptionId', 'subjectId', 'schoolPeriodId', 'gradeId', 'sectionId'],
                transaction: t,
            });
            // group -> chosen subjectId (the row that exists, preferring one with notes)
            const groupToSubjectId = new Map();
            const byGroup = new Map();
            for (const is of inscriptionSubjects) {
                const gid = (_a = is.subject) === null || _a === void 0 ? void 0 : _a.subjectGroupId;
                if (gid == null)
                    continue;
                const arr = byGroup.get(gid);
                if (arr)
                    arr.push(is);
                else
                    byGroup.set(gid, [is]);
            }
            for (const [gid, rows] of byGroup) {
                if (rows.length === 1) {
                    groupToSubjectId.set(gid, rows[0].subjectId);
                }
                else {
                    const withQuals = rows.filter((r) => (r.qualifications || []).length > 0);
                    groupToSubjectId.set(gid, (withQuals[0] || rows[0]).subjectId);
                }
            }
            // Build choice rows for every (group, term) pair.
            const rows = [];
            for (const [gid, subjectId] of groupToSubjectId) {
                for (const term of terms) {
                    rows.push({ inscriptionId, subjectGroupId: gid, termId: term.id, subjectId });
                }
            }
            if (rows.length > 0) {
                // upsert via destroy+bulkCreate to honor the unique constraint
                yield index_1.InscriptionGroupTermChoice.destroy({
                    where: {
                        inscriptionId,
                        subjectGroupId: rows.map(r => r.subjectGroupId),
                    },
                    transaction: t,
                });
                yield index_1.InscriptionGroupTermChoice.bulkCreate(rows, {
                    transaction: t,
                    validate: true,
                });
            }
            if (ownTransaction)
                yield t.commit();
        }
        catch (error) {
            if (ownTransaction)
                yield t.rollback();
            throw error;
        }
    });
}
function changeGroupSubjectFromTerm(inscriptionId_1, subjectGroupId_1, newSubjectId_1, fromTermId_1) {
    return __awaiter(this, arguments, void 0, function* (inscriptionId, subjectGroupId, newSubjectId, fromTermId, options = {}) {
        var _a, _b, _c;
        const { transaction: t = yield database_1.default.transaction() } = options;
        const ownTransaction = !options.transaction;
        try {
            const inscription = yield index_1.Inscription.findByPk(inscriptionId, { transaction: t });
            if (!inscription)
                throw new Error('Inscription not found');
            const terms = yield index_1.Term.findAll({
                where: { schoolPeriodId: inscription.schoolPeriodId },
                order: [['order', 'ASC']],
                transaction: t,
            });
            const fromIdx = terms.findIndex(term => term.id === fromTermId);
            if (fromIdx === -1)
                throw new Error('fromTermId does not belong to this inscription period');
            const affectedTerms = terms.slice(fromIdx).map(term => term.id);
            // Update choice records for affected terms.
            yield index_1.InscriptionGroupTermChoice.destroy({
                where: { inscriptionId, subjectGroupId, termId: affectedTerms },
                transaction: t,
            });
            yield index_1.InscriptionGroupTermChoice.bulkCreate(affectedTerms.map(termId => ({ inscriptionId, subjectGroupId, termId, subjectId: newSubjectId })), { transaction: t, validate: true });
            // Ensure the new subject has an InscriptionSubject row so the professor
            // can enter notes. The old subject's row and notes are left untouched.
            const ctxIns = yield index_1.Inscription.findByPk(inscriptionId, { attributes: ['id', 'schoolPeriodId', 'gradeId', 'sectionId'], transaction: t });
            yield index_1.InscriptionSubject.findOrCreate({
                where: { inscriptionId, subjectId: newSubjectId },
                defaults: {
                    inscriptionId,
                    subjectId: newSubjectId,
                    schoolPeriodId: (_a = ctxIns === null || ctxIns === void 0 ? void 0 : ctxIns.schoolPeriodId) !== null && _a !== void 0 ? _a : null,
                    gradeId: (_b = ctxIns === null || ctxIns === void 0 ? void 0 : ctxIns.gradeId) !== null && _b !== void 0 ? _b : null,
                    sectionId: (_c = ctxIns === null || ctxIns === void 0 ? void 0 : ctxIns.sectionId) !== null && _c !== void 0 ? _c : null,
                },
                transaction: t,
            });
            if (ownTransaction)
                yield t.commit();
            return {
                inscriptionId,
                subjectGroupId,
                fromTermId,
                newSubjectId,
                termsAffected: affectedTerms,
            };
        }
        catch (error) {
            if (ownTransaction)
                yield t.rollback();
            throw error;
        }
    });
}
/**
 * Explicitly set the subject for a single (inscription, group, term). Used by
 * the backfill UI to record historical choices. Does NOT touch notes — the
 * caller is asserting "this is what the student took in that term".
 */
function setGroupSubjectForTerm(inscriptionId_1, subjectGroupId_1, termId_1, subjectId_1) {
    return __awaiter(this, arguments, void 0, function* (inscriptionId, subjectGroupId, termId, subjectId, options = {}) {
        var _a, _b, _c;
        const { transaction: t = yield database_1.default.transaction() } = options;
        const ownTransaction = !options.transaction;
        try {
            yield index_1.InscriptionGroupTermChoice.destroy({
                where: { inscriptionId, subjectGroupId, termId },
                transaction: t,
            });
            yield index_1.InscriptionGroupTermChoice.create({ inscriptionId, subjectGroupId, termId, subjectId }, { transaction: t });
            // Ensure the InscriptionSubject row exists so notes can be attached.
            const ctxIns = yield index_1.Inscription.findByPk(inscriptionId, { attributes: ['id', 'schoolPeriodId', 'gradeId', 'sectionId'], transaction: t });
            yield index_1.InscriptionSubject.findOrCreate({
                where: { inscriptionId, subjectId },
                defaults: {
                    inscriptionId,
                    subjectId,
                    schoolPeriodId: (_a = ctxIns === null || ctxIns === void 0 ? void 0 : ctxIns.schoolPeriodId) !== null && _a !== void 0 ? _a : null,
                    gradeId: (_b = ctxIns === null || ctxIns === void 0 ? void 0 : ctxIns.gradeId) !== null && _b !== void 0 ? _b : null,
                    sectionId: (_c = ctxIns === null || ctxIns === void 0 ? void 0 : ctxIns.sectionId) !== null && _c !== void 0 ? _c : null,
                },
                transaction: t,
            });
            if (ownTransaction)
                yield t.commit();
        }
        catch (error) {
            if (ownTransaction)
                yield t.rollback();
            throw error;
        }
    });
}
/**
 * Bulk seed for all inscriptions in a period. Used by the one-time migration.
 */
function seedChoicesForPeriod(schoolPeriodId_1) {
    return __awaiter(this, arguments, void 0, function* (schoolPeriodId, options = {}) {
        const { transaction: t = yield database_1.default.transaction() } = options;
        const ownTransaction = !options.transaction;
        try {
            const inscriptions = yield index_1.Inscription.findAll({
                where: { schoolPeriodId },
                attributes: ['id'],
                transaction: t,
            });
            let count = 0;
            for (const ins of inscriptions) {
                yield seedChoicesForInscription(ins.id, { transaction: t });
                count++;
            }
            if (ownTransaction)
                yield t.commit();
            return count;
        }
        catch (error) {
            if (ownTransaction)
                yield t.rollback();
            throw error;
        }
    });
}
