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
    up: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        yield queryInterface.createTable('section_guides', {
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            teacherId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'people', key: 'id' },
            },
            gradeId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'grades', key: 'id' },
            },
            sectionId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'sections', key: 'id' },
            },
            schoolPeriodId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: { model: 'school_periods', key: 'id' },
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
        yield queryInterface.addIndex('section_guides', ['gradeId', 'sectionId', 'schoolPeriodId'], {
            unique: true,
            name: 'unique_guide_per_grade_section_period',
        });
    }),
    down: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        yield queryInterface.dropTable('section_guides');
    })
};
