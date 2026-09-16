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
exports.up = up;
exports.down = down;
const sequelize_1 = require("sequelize");
function up(queryInterface) {
    return __awaiter(this, void 0, void 0, function* () {
        // Add color to period_grade_sections
        yield queryInterface.addColumn('period_grade_sections', 'color', {
            type: sequelize_1.DataTypes.STRING(7),
            allowNull: false,
            defaultValue: '#ffffff',
        });
        // Clean up: remove color from sections if it exists from previous migration
        try {
            yield queryInterface.removeColumn('sections', 'color');
        }
        catch (_a) {
            // Safe to ignore if column doesn't exist
        }
    });
}
function down(queryInterface) {
    return __awaiter(this, void 0, void 0, function* () {
        yield queryInterface.removeColumn('period_grade_sections', 'color');
    });
}
