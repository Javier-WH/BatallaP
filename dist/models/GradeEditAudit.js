"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const SubjectFinalGrade_1 = __importDefault(require("./SubjectFinalGrade"));
const GradeEditPermission_1 = __importDefault(require("./GradeEditPermission"));
const User_1 = __importDefault(require("./User"));
class GradeEditAudit extends sequelize_1.Model {
}
GradeEditAudit.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    subjectFinalGradeId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: SubjectFinalGrade_1.default,
            key: 'id',
        },
        comment: 'Nota final que fue modificada',
    },
    permissionId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: GradeEditPermission_1.default,
            key: 'id',
        },
        comment: 'Permiso que autorizó la modificación',
    },
    editedBy: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User_1.default,
            key: 'id',
        },
        comment: 'Usuario que realizó la modificación',
    },
    previousScore: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Valor de la nota antes de la modificación',
    },
    newScore: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Valor de la nota después de la modificación',
    },
    previousStatus: {
        type: sequelize_1.DataTypes.ENUM('aprobada', 'reprobada'),
        allowNull: true,
        comment: 'Estado de la materia antes de la modificación',
    },
    newStatus: {
        type: sequelize_1.DataTypes.ENUM('aprobada', 'reprobada'),
        allowNull: false,
        comment: 'Estado de la materia después de la modificación',
    },
    reason: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
        comment: 'Razón de la modificación',
    },
    editedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
        comment: 'Fecha y hora de la modificación',
    },
    actCode: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        comment: 'Número de acta asociado a la modificación',
    },
    previousPlantelId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        comment: 'Plantel asociado a la nota antes de la modificación',
    },
    newPlantelId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        comment: 'Plantel asociado a la nota después de la modificación',
    },
}, {
    sequelize: database_1.default,
    tableName: 'grade_edit_audits',
    indexes: [
        {
            unique: false,
            fields: ['subjectFinalGradeId'],
        },
        {
            unique: false,
            fields: ['permissionId'],
        },
        {
            unique: false,
            fields: ['editedBy'],
        },
        {
            unique: false,
            fields: ['editedAt'],
        },
    ],
});
exports.default = GradeEditAudit;
