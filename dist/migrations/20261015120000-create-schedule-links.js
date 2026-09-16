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
            yield queryInterface.createTable('schedule_links', {
                id: {
                    type: sequelize_1.DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                },
                name: {
                    type: sequelize_1.DataTypes.STRING(120),
                    allowNull: true,
                },
                schoolPeriodId: {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: 'school_periods', key: 'id' },
                    onDelete: 'CASCADE',
                },
                createdAt: {
                    type: sequelize_1.DataTypes.DATE,
                    allowNull: false,
                },
                updatedAt: {
                    type: sequelize_1.DataTypes.DATE,
                    allowNull: false,
                },
            });
            yield queryInterface.createTable('schedule_link_items', {
                id: {
                    type: sequelize_1.DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                },
                linkId: {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: 'schedule_links', key: 'id' },
                    onDelete: 'CASCADE',
                },
                subjectId: {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: 'subjects', key: 'id' },
                },
                periodGradeId: {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: 'period_grades', key: 'id' },
                },
                createdAt: {
                    type: sequelize_1.DataTypes.DATE,
                    allowNull: false,
                },
                updatedAt: {
                    type: sequelize_1.DataTypes.DATE,
                    allowNull: false,
                },
            });
            // A (subjectId, periodGradeId) pair can only belong to one link
            yield queryInterface.addIndex('schedule_link_items', ['subjectId', 'periodGradeId'], {
                unique: true,
                name: 'schedule_link_items_subject_id_period_grade_id_unique',
            });
        });
    },
    down(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield queryInterface.removeIndex('schedule_link_items', 'schedule_link_items_subject_id_period_grade_id_unique');
            }
            catch (e) {
                console.log('[migration] Index not found, skipping drop');
            }
            yield queryInterface.dropTable('schedule_link_items');
            yield queryInterface.dropTable('schedule_links');
        });
    },
};
