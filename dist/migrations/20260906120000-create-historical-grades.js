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
            yield queryInterface.createTable('historical_grades', {
                id: {
                    type: sequelize_1.DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                },
                personId: {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: 'people', key: 'id' },
                    onDelete: 'CASCADE',
                },
                gradeId: {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: 'grades', key: 'id' },
                },
                subjectId: {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: false,
                    references: { model: 'subjects', key: 'id' },
                },
                schoolPeriodId: {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: true,
                    references: { model: 'school_periods', key: 'id' },
                },
                finalScore: {
                    type: sequelize_1.DataTypes.DECIMAL(5, 2),
                    allowNull: true,
                },
                status: {
                    type: sequelize_1.DataTypes.ENUM('aprobada', 'reprobada'),
                    allowNull: false,
                    defaultValue: 'reprobada',
                },
                gradeType: {
                    type: sequelize_1.DataTypes.ENUM('regular', 'revision', 'materia_pendiente', 'transferencia', 'equivalencia'),
                    allowNull: false,
                    defaultValue: 'regular',
                },
                plantelId: {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: true,
                    references: { model: 'planteles', key: 'id' },
                },
                date: {
                    type: sequelize_1.DataTypes.DATEONLY,
                    allowNull: true,
                },
                notes: {
                    type: sequelize_1.DataTypes.TEXT,
                    allowNull: true,
                },
                createdBy: {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: true,
                    references: { model: 'users', key: 'id' },
                    onDelete: 'SET NULL',
                },
                createdAt: {
                    type: sequelize_1.DataTypes.DATE,
                    allowNull: false,
                    defaultValue: sequelize_1.DataTypes.NOW,
                },
                updatedAt: {
                    type: sequelize_1.DataTypes.DATE,
                    allowNull: false,
                    defaultValue: sequelize_1.DataTypes.NOW,
                },
            });
            yield queryInterface.addIndex('historical_grades', {
                unique: true,
                fields: ['personId', 'gradeId', 'subjectId'],
                name: 'uq_historical_grades_person_grade_subject',
            });
        });
    },
    down(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryInterface.dropTable('historical_grades');
            yield queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_historical_grades_status');
            yield queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_historical_grades_gradeType');
        });
    },
};
