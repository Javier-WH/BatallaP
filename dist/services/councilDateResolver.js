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
exports.SCHOOL_TIMEZONE = void 0;
exports.formatDateInCaracas = formatDateInCaracas;
exports.formatDateOnly = formatDateOnly;
exports.resolveCouncilDate = resolveCouncilDate;
const index_1 = require("../models/index.js");
/**
 * Timezone used across the app for calendar-date semantics (Venezuela, UTC-4).
 */
exports.SCHOOL_TIMEZONE = 'America/Caracas';
/**
 * Format any date-like value as 'YYYY-MM-DD' interpreted in the school
 * timezone (America/Caracas), NOT in UTC. Using toISOString() would shift
 * the calendar day for instants after 20:00 Caracas (00:00 UTC next day).
 *
 * - Date            -> formatted in America/Caracas
 * - 'YYYY-MM-DD...' -> returned as-is (already a calendar date)
 * - null/undefined  -> null
 */
function formatDateInCaracas(value) {
    if (!value)
        return null;
    if (typeof value === 'string') {
        return value.split('T')[0].split(' ')[0] || null;
    }
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: exports.SCHOOL_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(value);
    return parts || null;
}
/** Format a DATEONLY value without applying a timezone shift. */
function formatDateOnly(value) {
    if (!value)
        return null;
    if (typeof value === 'string')
        return value.split('T')[0].split(' ')[0] || null;
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}
/**
 * Resolve the official council completion date for certified documents.
 *
 * Priority:
 *  1. Term.councilCompletedAtOverride — Master override for the whole lapso
 *     (applies to every section in that term).
 *  2. CouncilChecklist.completedAt of the term + section, when status='done'.
 *  3. null — caller falls back to SubjectFinalGrade.calculatedAt.
 *
 * When `termId` is omitted, the LAST term of the period (highest `order`) is
 * used, since final grades derive from the last lapso's council.
 *
 * Returns a 'YYYY-MM-DD' string or null.
 */
function resolveCouncilDate(params) {
    return __awaiter(this, void 0, void 0, function* () {
        const { schoolPeriodId, sectionId } = params;
        const term = params.termId
            ? yield index_1.Term.findByPk(params.termId, { attributes: ['id', 'councilCompletedAtOverride'] })
            : yield index_1.Term.findOne({
                where: { schoolPeriodId },
                order: [['order', 'DESC']],
                attributes: ['id', 'councilCompletedAtOverride'],
            });
        if (!term)
            return null;
        // 1. Master override wins over everything else
        if (term.councilCompletedAtOverride) {
            return term.councilCompletedAtOverride;
        }
        // 2. Checklist completion date for this term + section
        if (sectionId) {
            const checklist = yield index_1.CouncilChecklist.findOne({
                where: {
                    schoolPeriodId,
                    sectionId,
                    termId: term.id,
                    status: 'done',
                },
                attributes: ['completedAt'],
            });
            if (checklist === null || checklist === void 0 ? void 0 : checklist.completedAt) {
                return formatDateInCaracas(checklist.completedAt);
            }
        }
        return null;
    });
}
