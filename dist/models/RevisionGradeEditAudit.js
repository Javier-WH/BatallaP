"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const InscriptionSubjectRevision_1 = __importDefault(require("./InscriptionSubjectRevision"));
const Person_1 = __importDefault(require("./Person"));
class RevisionGradeEditAudit extends sequelize_1.Model {
}
RevisionGradeEditAudit.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    revisionId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: InscriptionSubjectRevision_1.default,
            key: 'id',
        },
        comment: 'Revisión cuya nota fue modificada',
    },
    editedBy: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Person_1.default,
            key: 'id',
        },
        comment: 'Usuario de Control de Estudios que realizó la modificación',
    },
    previousScore: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Nota antes de la modificación',
    },
    newScore: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Nota después de la modificación',
    },
    previousStatus: {
        type: sequelize_1.DataTypes.ENUM('pending', 'approved', 'failed'),
        allowNull: false,
        comment: 'Estado antes de la modificación',
    },
    newStatus: {
        type: sequelize_1.DataTypes.ENUM('pending', 'approved', 'failed'),
        allowNull: false,
        comment: 'Estado después de la modificación',
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
        comment: 'Motivo opcional de la modificación extraordinaria',
    },
    editedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
}, {
    sequelize: database_1.default,
    tableName: 'revision_grade_edit_audits',
    indexes: [
        { unique: false, fields: ['revisionId'] },
        { unique: false, fields: ['editedBy'] },
        { unique: false, fields: ['editedAt'] },
    ],
});
exports.default = RevisionGradeEditAudit;
