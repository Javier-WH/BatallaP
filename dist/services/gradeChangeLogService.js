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
exports.logGradeChange = logGradeChange;
const GradeChangeLog_1 = __importDefault(require("../models/GradeChangeLog.js"));
/**
 * Unified grade change logger.
 * Only logs when the score actually changed (previousScore !== newScore).
 * Never throws — if logging fails, the error is swallowed and printed to console
 * so the primary grade operation is not affected.
 */
function logGradeChange(params, transaction) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        // Skip if score didn't change
        if (Number(params.previousScore) === Number(params.newScore) && !params.previousStatus)
            return;
        try {
            // Truncate editorRole to 50 chars to match column STRING(50)
            const safeEditorRole = params.editorRole ? params.editorRole.substring(0, 50) : null;
            yield GradeChangeLog_1.default.create({
                entityType: params.entityType,
                entityId: params.entityId,
                previousScore: params.previousScore != null ? Number(params.previousScore) : null,
                newScore: params.newScore != null ? Number(params.newScore) : null,
                previousStatus: (_a = params.previousStatus) !== null && _a !== void 0 ? _a : null,
                newStatus: (_b = params.newStatus) !== null && _b !== void 0 ? _b : null,
                gradeType: (_c = params.gradeType) !== null && _c !== void 0 ? _c : null,
                editedBy: params.editedBy,
                editorRole: safeEditorRole,
                reason: (_d = params.reason) !== null && _d !== void 0 ? _d : null,
                actCode: (_e = params.actCode) !== null && _e !== void 0 ? _e : null,
                metadata: (_f = params.metadata) !== null && _f !== void 0 ? _f : null,
                editedAt: new Date(),
            }, transaction ? { transaction } : undefined);
        }
        catch (error) {
            console.error('[gradeChangeLogService] Failed to log grade change:', error);
        }
    });
}
exports.default = { logGradeChange };
