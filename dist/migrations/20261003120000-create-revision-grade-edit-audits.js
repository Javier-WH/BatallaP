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
            const tables = yield queryInterface.showAllTables();
            if (!tables.includes('revision_grade_edit_audits')) {
                yield queryInterface.createTable('revision_grade_edit_audits', {
                    id: {
                        type: sequelize_1.DataTypes.INTEGER,
                        autoIncrement: true,
                        primaryKey: true,
                    },
                    revisionId: {
                        type: sequelize_1.DataTypes.INTEGER,
                        allowNull: false,
                        references: {
                            model: 'inscription_subject_revisions',
                            key: 'id',
                        },
                        comment: 'Revisión cuya nota fue modificada',
                    },
                    editedBy: {
                        type: sequelize_1.DataTypes.INTEGER,
                        allowNull: false,
                        references: {
                            model: 'people',
                            key: 'id',
                        },
                        comment: 'Usuario de Control de Estudios que realizó la modificación',
                    },
                    previousScore: {
                        type: sequelize_1.DataTypes.DECIMAL(5, 2),
                        allowNull: true,
                    },
                    newScore: {
                        type: sequelize_1.DataTypes.DECIMAL(5, 2),
                        allowNull: true,
                    },
                    previousStatus: {
                        type: sequelize_1.DataTypes.ENUM('pending', 'approved', 'failed'),
                        allowNull: false,
                    },
                    newStatus: {
                        type: sequelize_1.DataTypes.ENUM('pending', 'approved', 'failed'),
                        allowNull: false,
                    },
                    previousIsAbsent: {
                        type: sequelize_1.DataTypes.BOOLEAN,
                        allowNull: false,
                        defaultValue: false,
                    },
                    newIsAbsent: {
                        type: sequelize_1.DataTypes.BOOLEAN,
                        allowNull: false,
                        defaultValue: false,
                    },
                    reason: {
                        type: sequelize_1.DataTypes.TEXT,
                        allowNull: true,
                    },
                    editedAt: {
                        type: sequelize_1.DataTypes.DATE,
                        allowNull: false,
                        defaultValue: sequelize_1.DataTypes.NOW,
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
                yield queryInterface.addIndex('revision_grade_edit_audits', ['revisionId']);
                yield queryInterface.addIndex('revision_grade_edit_audits', ['editedBy']);
                yield queryInterface.addIndex('revision_grade_edit_audits', ['editedAt']);
            }
        });
    },
    down(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            const tables = yield queryInterface.showAllTables();
            if (tables.includes('revision_grade_edit_audits')) {
                yield queryInterface.dropTable('revision_grade_edit_audits');
            }
        });
    }
};
