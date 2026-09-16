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
            const tableDesc = yield queryInterface.describeTable('enrollment_plans');
            if (!tableDesc.schoolPeriodId) {
                // Add column as nullable first
                yield queryInterface.addColumn('enrollment_plans', 'schoolPeriodId', {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: true,
                    references: { model: 'school_periods', key: 'id' },
                    onDelete: 'CASCADE',
                });
                // Backfill: assign the active period to existing plans
                yield queryInterface.sequelize.query(`
        UPDATE enrollment_plans ep
        SET schoolPeriodId = (
          SELECT id FROM school_periods WHERE status = 'activo' LIMIT 1
        )
        WHERE ep.schoolPeriodId IS NULL;
      `);
                // Now make it NOT NULL
                yield queryInterface.changeColumn('enrollment_plans', 'schoolPeriodId', {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: 'school_periods', key: 'id' },
                    onDelete: 'CASCADE',
                });
            }
        });
    },
    down(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            const tableDesc = yield queryInterface.describeTable('enrollment_plans');
            if (tableDesc.schoolPeriodId) {
                yield queryInterface.removeColumn('enrollment_plans', 'schoolPeriodId');
            }
        });
    },
};
