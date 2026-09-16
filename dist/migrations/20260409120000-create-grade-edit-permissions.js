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
        yield queryInterface.createTable('grade_edit_permissions', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: sequelize_1.DataTypes.INTEGER
            },
            schoolPeriodId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'school_periods',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
                comment: 'Null = permiso global para todos los períodos'
            },
            grantedBy: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT',
                comment: 'Administrador que otorgó el permiso'
            },
            grantedTo: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT',
                comment: 'Usuario de Control de Estudios receptor del permiso'
            },
            actCode: {
                type: sequelize_1.DataTypes.STRING(50),
                allowNull: false,
                comment: 'Código de acta que justifica el permiso'
            },
            observations: {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: false,
                comment: 'Observaciones sobre el permiso otorgado'
            },
            isActive: {
                type: sequelize_1.DataTypes.BOOLEAN,
                defaultValue: true,
                allowNull: false,
                comment: 'Indica si el permiso está activo'
            },
            grantedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize_1.DataTypes.NOW,
                comment: 'Fecha y hora cuando se otorgó el permiso'
            },
            revokedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true,
                comment: 'Fecha y hora cuando se revocó el permiso'
            },
            revokedBy: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL',
                comment: 'Administrador que revocó el permiso'
            },
            createdAt: {
                allowNull: false,
                type: sequelize_1.DataTypes.DATE
            },
            updatedAt: {
                allowNull: false,
                type: sequelize_1.DataTypes.DATE
            }
        });
        // Add indexes
        yield queryInterface.addIndex('grade_edit_permissions', ['schoolPeriodId', 'grantedTo']);
        yield queryInterface.addIndex('grade_edit_permissions', ['grantedTo']);
        yield queryInterface.addIndex('grade_edit_permissions', ['isActive']);
        yield queryInterface.createTable('grade_edit_audits', {
            id: {
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
                type: sequelize_1.DataTypes.INTEGER
            },
            subjectFinalGradeId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'subject_final_grades',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT',
                comment: 'Nota final que fue modificada'
            },
            permissionId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'grade_edit_permissions',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT',
                comment: 'Permiso que autorizó la modificación'
            },
            editedBy: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT',
                comment: 'Usuario que realizó la modificación'
            },
            previousScore: {
                type: sequelize_1.DataTypes.DECIMAL(5, 2),
                allowNull: true,
                comment: 'Valor de la nota antes de la modificación'
            },
            newScore: {
                type: sequelize_1.DataTypes.DECIMAL(5, 2),
                allowNull: true,
                comment: 'Valor de la nota después de la modificación'
            },
            previousStatus: {
                type: sequelize_1.DataTypes.ENUM('aprobada', 'reprobada'),
                allowNull: false,
                comment: 'Estado de la materia antes de la modificación'
            },
            newStatus: {
                type: sequelize_1.DataTypes.ENUM('aprobada', 'reprobada'),
                allowNull: false,
                comment: 'Estado de la materia después de la modificación'
            },
            reason: {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: false,
                comment: 'Razón de la modificación'
            },
            editedAt: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: false,
                defaultValue: sequelize_1.DataTypes.NOW,
                comment: 'Fecha y hora de la modificación'
            },
            createdAt: {
                allowNull: false,
                type: sequelize_1.DataTypes.DATE
            },
            updatedAt: {
                allowNull: false,
                type: sequelize_1.DataTypes.DATE
            }
        });
        // Add indexes
        yield queryInterface.addIndex('grade_edit_audits', ['subjectFinalGradeId']);
        yield queryInterface.addIndex('grade_edit_audits', ['permissionId']);
        yield queryInterface.addIndex('grade_edit_audits', ['editedBy']);
        yield queryInterface.addIndex('grade_edit_audits', ['editedAt']);
    }),
    down: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        yield queryInterface.dropTable('grade_edit_audits');
        yield queryInterface.dropTable('grade_edit_permissions');
    })
};
