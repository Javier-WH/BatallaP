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
exports.GradeRoundingService = void 0;
const index_1 = require("../models/index.js");
/**
 * Service for grade rounding configuration.
 * The backend always returns exact values from the database.
 * The frontend is responsible for applying rounding visually based on this setting.
 */
class GradeRoundingService {
    /**
     * Check if grade rounding is enabled in the system settings.
     * @returns Promise<boolean> - true if rounding is enabled, false otherwise
     */
    static isRoundingEnabled() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const setting = yield index_1.Setting.findOne({
                    where: { key: 'enable_grade_rounding' }
                });
                if (!setting) {
                    // Default to false if setting doesn't exist
                    return false;
                }
                return setting.value === 'true';
            }
            catch (error) {
                console.error('[GradeRoundingService] Error checking rounding setting:', error);
                // Default to false on error
                return false;
            }
        });
    }
}
exports.GradeRoundingService = GradeRoundingService;
exports.default = GradeRoundingService;
