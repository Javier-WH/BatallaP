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
exports.resolveGradeDate = resolveGradeDate;
const councilDateResolver_1 = require("./councilDateResolver");
const index_1 = require("../models/index.js");
/**
 * Resolve the correct date for a grade based on its gradeType.
 *
 * - For 'revision' and 'revision_materia_pendiente': use the date from
 *   RevisionOpportunityDate for the opportunity where the student approved,
 *   or the last opportunity date if never approved.
 *
 * - For 'materia_pendiente': use the date from PendingSubjectEncounter for
 *   the encounter where the student approved (score >= 10, not absent),
 *   or the last encounter date if never approved.
 *
 * - For other gradeTypes (regular, transferencia, equivalencia): return null
 *   so the caller falls back to calculatedAt.
 *
 * Returns a "YYYY-MM-DD" string or null.
 */
function resolveGradeDate(inscriptionSubjectId, gradeType, sectionId, subjectId, gradeId, schoolPeriodId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!gradeType)
            return null;
        const isRevision = gradeType === 'revision' || gradeType === 'revision_materia_pendiente';
        const isMP = gradeType === 'materia_pendiente' || gradeType === 'revision_materia_pendiente';
        if (isRevision) {
            const revDate = yield resolveRevisionDate(inscriptionSubjectId, sectionId !== null && sectionId !== void 0 ? sectionId : null, subjectId !== null && subjectId !== void 0 ? subjectId : null, gradeId !== null && gradeId !== void 0 ? gradeId : null, schoolPeriodId !== null && schoolPeriodId !== void 0 ? schoolPeriodId : null);
            if (revDate)
                return revDate;
        }
        if (isMP) {
            const mpDate = yield resolvePendingSubjectDate(inscriptionSubjectId);
            if (mpDate)
                return mpDate;
        }
        return null;
    });
}
function resolveRevisionDate(inscriptionSubjectId, sectionId, subjectId, gradeId, schoolPeriodId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Find all revision records for this inscription subject, ordered by opportunity
        const revisions = yield index_1.InscriptionSubjectRevision.findAll({
            where: { inscriptionSubjectId },
            order: [['opportunity', 'ASC']],
        });
        if (revisions.length === 0)
            return null;
        // Find the approved revision (if any)
        const approved = revisions.find(r => r.status === 'approved');
        // Determine which opportunity to use
        const targetOpportunity = approved ? approved.opportunity : revisions[revisions.length - 1].opportunity;
        const revisionPeriodId = approved ? approved.revisionPeriodId : revisions[revisions.length - 1].revisionPeriodId;
        // Find the PeriodGradeSubject for this subject+grade+period
        let periodGradeSubjectId = null;
        if (schoolPeriodId && gradeId) {
            const pg = yield index_1.PeriodGrade.findOne({
                where: { schoolPeriodId, gradeId },
                attributes: ['id'],
            });
            if (pg && subjectId) {
                const pgs = yield index_1.PeriodGradeSubject.findOne({
                    where: { periodGradeId: pg.id, subjectId },
                    attributes: ['id'],
                });
                if (pgs)
                    periodGradeSubjectId = pgs.id;
            }
        }
        // Find the RevisionOpportunityDate matching revisionPeriodId + opportunity + periodGradeSubjectId
        const where = {
            revisionPeriodId,
            opportunity: targetOpportunity,
        };
        if (periodGradeSubjectId) {
            where.periodGradeSubjectId = periodGradeSubjectId;
        }
        // Try with sectionId first (more specific)
        if (sectionId) {
            const withSection = yield index_1.RevisionOpportunityDate.findOne({
                where: Object.assign(Object.assign({}, where), { sectionId }),
            });
            if (withSection === null || withSection === void 0 ? void 0 : withSection.date)
                return withSection.date;
        }
        // Try without sectionId (applies to all sections)
        const withoutSection = yield index_1.RevisionOpportunityDate.findOne({
            where: Object.assign(Object.assign({}, where), { sectionId: null }),
        });
        if (withoutSection === null || withoutSection === void 0 ? void 0 : withoutSection.date)
            return withoutSection.date;
        // Fallback: get the last opportunity date for this revision period + subject (any section)
        const allDates = yield index_1.RevisionOpportunityDate.findAll({
            where: periodGradeSubjectId ? { revisionPeriodId, periodGradeSubjectId } : { revisionPeriodId },
            order: [['opportunity', 'DESC']],
        });
        // Find the one matching targetOpportunity, or the last one
        const match = allDates.find(d => d.opportunity === targetOpportunity) || allDates[0];
        return (match === null || match === void 0 ? void 0 : match.date) ? (0, councilDateResolver_1.formatDateInCaracas)(match.date) : null;
    });
}
function resolvePendingSubjectDate(inscriptionSubjectId) {
    return __awaiter(this, void 0, void 0, function* () {
        // Get the InscriptionSubject to find inscriptionId + subjectId
        const insSub = yield index_1.InscriptionSubject.findByPk(inscriptionSubjectId, {
            attributes: ['inscriptionId', 'subjectId'],
        });
        if (!insSub)
            return null;
        // Find the PendingSubject for this inscription + subject
        const pendingSubj = yield index_1.PendingSubject.findOne({
            where: { newInscriptionId: insSub.inscriptionId, subjectId: insSub.subjectId },
            attributes: ['id'],
        });
        if (!pendingSubj)
            return null;
        // Get all encounters ordered by encounterNumber
        const encounters = yield index_1.PendingSubjectEncounter.findAll({
            where: { pendingSubjectId: pendingSubj.id },
            order: [['encounterNumber', 'ASC']],
        });
        if (encounters.length === 0)
            return null;
        // Find the encounter where the student approved (score >= 10, not absent)
        const approved = encounters.find(e => e.score !== null && Number(e.score) >= 10 && !e.isAbsent);
        if (approved === null || approved === void 0 ? void 0 : approved.date) {
            return (0, councilDateResolver_1.formatDateInCaracas)(approved.date);
        }
        // Otherwise, use the last encounter's date
        const last = encounters[encounters.length - 1];
        if (last === null || last === void 0 ? void 0 : last.date) {
            return (0, councilDateResolver_1.formatDateInCaracas)(last.date);
        }
        return null;
    });
}
