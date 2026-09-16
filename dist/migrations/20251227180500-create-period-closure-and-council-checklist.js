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
        yield queryInterface.createTable('period_closures', {
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            schoolPeriodId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'school_periods',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            status: {
                type: sequelize_1.DataTypes.ENUM('draft', 'validating', 'closed', 'failed'),
                allowNull: false,
                defaultValue: 'draft'
            },
            initiatedBy: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'SET NULL'
            },
            startedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true
            },
            finishedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true
            },
            log: {
                type: sequelize_1.DataTypes.JSON,
                allowNull: true
            },
            snapshot: {
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
        yield queryInterface.addIndex('period_closures', ['schoolPeriodId']);
        yield queryInterface.addIndex('period_closures', ['status']);
        yield queryInterface.createTable('council_checklists', {
            id: {
                type: sequelize_1.DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            schoolPeriodId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'school_periods',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            gradeId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'grades',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            sectionId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'sections',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            termId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'terms',
                    key: 'id'
                },
                onDelete: 'CASCADE'
            },
            status: {
                type: sequelize_1.DataTypes.ENUM('open', 'in_review', 'done'),
                allowNull: false,
                defaultValue: 'open'
            },
            completedBy: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onDelete: 'SET NULL'
            },
            completedAt: {
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
        yield queryInterface.addConstraint('council_checklists', {
            type: 'unique',
            fields: ['schoolPeriodId', 'gradeId', 'sectionId', 'termId'],
            name: 'uq_council_checklists_scope'
        });
        yield queryInterface.addIndex('council_checklists', ['status']);
        yield queryInterface.addColumn('inscriptions', 'originPeriodId', {
            type: sequelize_1.DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'school_periods',
                key: 'id'
            },
            onDelete: 'SET NULL'
        });
        yield queryInterface.addColumn('inscriptions', 'isRepeater', {
            type: sequelize_1.DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        });
    }),
    down: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        yield queryInterface.removeColumn('inscriptions', 'isRepeater');
        yield queryInterface.removeColumn('inscriptions', 'originPeriodId');
        yield queryInterface.dropTable('council_checklists');
        yield queryInterface.dropTable('period_closures');
        yield queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_council_checklists_status');
        yield queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_period_closures_status');
    })
};
