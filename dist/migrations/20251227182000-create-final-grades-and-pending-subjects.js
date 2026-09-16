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
        yield queryInterface.createTable('subject_final_grades', {
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            inscriptionSubjectId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'inscription_subjects',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            finalScore: {
                type: sequelize_1.DataTypes.DECIMAL(5, 2),
                allowNull: true
            },
            rawScore: {
                type: sequelize_1.DataTypes.DECIMAL(5, 2),
                allowNull: true
            },
            councilPoints: {
                type: sequelize_1.DataTypes.DECIMAL(4, 2),
                allowNull: true,
                defaultValue: 0
            },
            status: {
                type: sequelize_1.DataTypes.ENUM('aprobada', 'reprobada'),
                allowNull: false,
                defaultValue: 'aprobada'
            },
            calculatedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize_1.DataTypes.NOW
            },
            createdAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize_1.DataTypes.NOW
            },
            updatedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize_1.DataTypes.NOW
            }
        });
        yield queryInterface.addConstraint('subject_final_grades', {
            type: 'unique',
            fields: ['inscriptionSubjectId'],
            name: 'uq_subject_final_grades_inscription_subject'
        });
        yield queryInterface.createTable('student_period_outcomes', {
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            inscriptionId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'inscriptions',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            finalAverage: {
                type: sequelize_1.DataTypes.DECIMAL(5, 2),
                allowNull: true
            },
            failedSubjects: {
                type: sequelize_1.DataTypes.TINYINT.UNSIGNED,
                allowNull: false,
                defaultValue: 0
            },
            status: {
                type: sequelize_1.DataTypes.ENUM('aprobado', 'materias_pendientes', 'reprobado'),
                allowNull: false,
                defaultValue: 'aprobado'
            },
            promotionGradeId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'grades',
                    key: 'id'
                },
                onDelete: 'SET NULL'
            },
            graduatedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true
            },
            metadata: {
                type: sequelize_1.DataTypes.JSON,
                allowNull: true
            },
            createdAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize_1.DataTypes.NOW
            },
            updatedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize_1.DataTypes.NOW
            }
        });
        yield queryInterface.addConstraint('student_period_outcomes', {
            type: 'unique',
            fields: ['inscriptionId'],
            name: 'uq_student_period_outcomes_inscription'
        });
        yield queryInterface.createTable('pending_subjects', {
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            newInscriptionId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'inscriptions',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            subjectId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'subjects',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            originPeriodId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'school_periods',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            status: {
                type: sequelize_1.DataTypes.ENUM('pendiente', 'aprobada', 'convalidada'),
                allowNull: false,
                defaultValue: 'pendiente'
            },
            resolvedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true
            },
            createdAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize_1.DataTypes.NOW
            },
            updatedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize_1.DataTypes.NOW
            }
        });
        yield queryInterface.addConstraint('pending_subjects', {
            type: 'unique',
            fields: ['newInscriptionId', 'subjectId'],
            name: 'uq_pending_subjects_inscription_subject'
        });
        yield queryInterface.addIndex('pending_subjects', ['newInscriptionId']);
        yield queryInterface.createTable('school_period_transition_rules', {
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            gradeFromId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'grades',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            gradeToId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'grades',
                    key: 'id'
                },
                onDelete: 'SET NULL'
            },
            minAverage: {
                type: sequelize_1.DataTypes.DECIMAL(4, 2),
                allowNull: false,
                defaultValue: 10
            },
            maxPendingSubjects: {
                type: sequelize_1.DataTypes.TINYINT.UNSIGNED,
                allowNull: false,
                defaultValue: 0
            },
            autoGraduate: {
                type: sequelize_1.DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            },
            createdAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize_1.DataTypes.NOW
            },
            updatedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize_1.DataTypes.NOW
            }
        });
        yield queryInterface.addConstraint('school_period_transition_rules', {
            type: 'unique',
            fields: ['gradeFromId'],
            name: 'uq_transition_rules_grade_from'
        });
    }),
    down: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        yield queryInterface.dropTable('school_period_transition_rules');
        yield queryInterface.dropTable('pending_subjects');
        yield queryInterface.dropTable('student_period_outcomes');
        yield queryInterface.dropTable('subject_final_grades');
        yield queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_subject_final_grades_status');
        yield queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_student_period_outcomes_status');
        yield queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_pending_subjects_status');
    })
};
