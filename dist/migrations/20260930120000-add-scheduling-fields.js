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
const sequelize_1 = require("sequelize");
exports.default = {
    up(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            // Add weeklyBlocks to period_grade_subjects
            const pgsDesc = yield queryInterface.describeTable('period_grade_subjects');
            if (!pgsDesc.weeklyBlocks) {
                yield queryInterface.addColumn('period_grade_subjects', 'weeklyBlocks', {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: false,
                    defaultValue: 2,
                });
            }
            // Add allowConsecutiveBlocks to subjects
            const subjDesc = yield queryInterface.describeTable('subjects');
            if (!subjDesc.allowConsecutiveBlocks) {
                yield queryInterface.addColumn('subjects', 'allowConsecutiveBlocks', {
                    type: sequelize_1.DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                });
            }
        });
    },
    down(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            const pgsDesc = yield queryInterface.describeTable('period_grade_subjects');
            if (pgsDesc.weeklyBlocks) {
                yield queryInterface.removeColumn('period_grade_subjects', 'weeklyBlocks');
            }
            const subjDesc = yield queryInterface.describeTable('subjects');
            if (subjDesc.allowConsecutiveBlocks) {
                yield queryInterface.removeColumn('subjects', 'allowConsecutiveBlocks');
            }
        });
    },
};
