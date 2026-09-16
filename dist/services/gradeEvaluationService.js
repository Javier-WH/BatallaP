"use strict";
/**
 * Single source of truth for deciding whether a grade is passing or failing.
 *
 * Grades are always DISPLAYED rounded to the nearest integer (see the frontend
 * helper `utils/gradeFormat.ts`). To keep the UI consistent with the persisted
 * academic status, the pass/fail decision must be taken on the SAME rounded
 * value the user sees: a raw score of 9.5 is shown as "10" and therefore counts
 * as passing when the passing grade is 10.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIN_FINAL_GRADE = void 0;
exports.roundGrade = roundGrade;
exports.roundFinalGrade = roundFinalGrade;
exports.isPassingGrade = isPassingGrade;
exports.resolveGradeStatus = resolveGradeStatus;
/** Rounds a raw score to the value shown in the UI and stored reports. */
function roundGrade(score) {
    // Fix floating-point precision errors (e.g. 15.499999999999998 → 15.5 → 16)
    return Math.round(Number(score.toFixed(2)));
}
/** Minimum allowed final grade. Even if all evaluations are 0, the definitive is at least 1. */
exports.MIN_FINAL_GRADE = 1;
/** Rounds a raw score and enforces the minimum final grade (01). */
function roundFinalGrade(score) {
    return Math.max(exports.MIN_FINAL_GRADE, roundGrade(score));
}
/** True when the rounded score reaches the passing grade. */
function isPassingGrade(score, passingGrade) {
    return roundGrade(score) >= passingGrade;
}
/** Resolves the academic status of a score against the passing grade. */
function resolveGradeStatus(score, passingGrade) {
    return isPassingGrade(score, passingGrade) ? 'aprobada' : 'reprobada';
}
