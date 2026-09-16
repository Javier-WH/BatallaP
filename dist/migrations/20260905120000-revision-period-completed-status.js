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
/**
 * Add 'completed' status to revision_periods and new audit fields.
 *
 * Status flow changes from:  pending → open → closed
 * to:                         pending → open → completed → closed
 *
 * - 'completed' = human check: revision grades are final, auto-fail pendings.
 *   FinalGradeCalculator reads revision grades from this point onward.
 * - 'closed' = set by periodClosureExecutor after the school year closure.
 *   Prevents further edits but does NOT trigger grade calculation.
 */
exports.default = {
    up(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. Add new columns
            const tableDesc = yield queryInterface.describeTable('revision_periods');
            if (!tableDesc.completedAt) {
                yield queryInterface.addColumn('revision_periods', 'completedAt', {
                    type: sequelize_1.DataTypes.DATE,
                    allowNull: true,
                });
            }
            if (!tableDesc.completedBy) {
                yield queryInterface.addColumn('revision_periods', 'completedBy', {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: true,
                    references: { model: 'users', key: 'id' },
                    onDelete: 'SET NULL',
                });
            }
            // 2. Change the status ENUM.
            //    MySQL ENUM: we must ALTER the column type to include the new value.
            //    Existing 'closed' rows are migrated to 'completed' so they remain
            //    valid (they were closed before this migration, meaning revisions
            //    were done; the new 'closed' will only be set by periodClosureExecutor).
            yield queryInterface.sequelize.query(`UPDATE revision_periods SET status = 'completed' WHERE status = 'closed'`);
            yield queryInterface.changeColumn('revision_periods', 'status', {
                type: sequelize_1.DataTypes.ENUM('pending', 'open', 'completed', 'closed'),
                allowNull: false,
                defaultValue: 'pending',
            });
        });
    },
    down(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            // Revert 'completed' back to 'closed' (closest old equivalent)
            yield queryInterface.sequelize.query(`UPDATE revision_periods SET status = 'closed' WHERE status = 'completed'`);
            yield queryInterface.changeColumn('revision_periods', 'status', {
                type: sequelize_1.DataTypes.ENUM('pending', 'open', 'closed'),
                allowNull: false,
                defaultValue: 'pending',
            });
            yield queryInterface.removeColumn('revision_periods', 'completedBy');
            yield queryInterface.removeColumn('revision_periods', 'completedAt');
        });
    },
};
