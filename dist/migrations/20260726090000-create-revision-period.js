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
module.exports = {
    up: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        yield queryInterface.createTable('revision_periods', {
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            schoolPeriodId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'school_periods',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            status: {
                type: sequelize_1.DataTypes.ENUM('pending', 'open', 'closed'),
                allowNull: false,
                defaultValue: 'pending',
            },
            maxOpportunities: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 3,
            },
            passingGrade: {
                type: sequelize_1.DataTypes.DECIMAL(5, 2),
                allowNull: false,
                defaultValue: 10.0,
            },
            openedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true,
            },
            closedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true,
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
        yield queryInterface.addConstraint('revision_periods', {
            type: 'unique',
            fields: ['schoolPeriodId'],
            name: 'uq_revision_periods_school_period',
        });
        yield queryInterface.createTable('inscription_subject_revisions', {
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            revisionPeriodId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'revision_periods',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            inscriptionSubjectId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'inscription_subjects',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            opportunity: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1,
            },
            score: {
                type: sequelize_1.DataTypes.DECIMAL(5, 2),
                allowNull: true,
            },
            status: {
                type: sequelize_1.DataTypes.ENUM('pending', 'approved', 'failed'),
                allowNull: false,
                defaultValue: 'pending',
            },
            gradedBy: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'people',
                    key: 'id',
                },
                onDelete: 'SET NULL',
            },
            gradedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true,
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
        yield queryInterface.addConstraint('inscription_subject_revisions', {
            type: 'unique',
            fields: ['revisionPeriodId', 'inscriptionSubjectId', 'opportunity'],
            name: 'uq_inscription_subject_revisions',
        });
        yield queryInterface.addIndex('inscription_subject_revisions', ['inscriptionSubjectId']);
        // Add historic fields to subject_final_grades
        yield queryInterface.addColumn('subject_final_grades', 'originalScore', {
            type: sequelize_1.DataTypes.DECIMAL(5, 2),
            allowNull: true,
        });
        yield queryInterface.addColumn('subject_final_grades', 'originalStatus', {
            type: sequelize_1.DataTypes.ENUM('aprobada', 'reprobada'),
            allowNull: true,
        });
    }),
    down: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        yield queryInterface.removeColumn('subject_final_grades', 'originalStatus');
        yield queryInterface.removeColumn('subject_final_grades', 'originalScore');
        yield queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_inscription_subject_revisions_status');
        yield queryInterface.dropTable('inscription_subject_revisions');
        yield queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_revision_periods_status');
        yield queryInterface.dropTable('revision_periods');
    }),
};
