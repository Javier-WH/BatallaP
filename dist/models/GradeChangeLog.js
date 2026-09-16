"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const User_1 = __importDefault(require("./User"));
class GradeChangeLog extends sequelize_1.Model {
}
GradeChangeLog.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    entityType: {
        type: sequelize_1.DataTypes.ENUM('qualification', 'subject_final_grade', 'historical_grade', 'inscription_subject_revision', 'pending_subject_encounter'),
        allowNull: false,
        comment: 'Type of grade entity that was modified',
    },
    entityId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        comment: 'ID of the modified record',
    },
    previousScore: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Score before the edit',
    },
    newScore: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Score after the edit',
    },
    previousStatus: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
        comment: 'Status before the edit (aprobada/reprobada/pending/approved/failed)',
    },
    newStatus: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
        comment: 'Status after the edit',
    },
    gradeType: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
        comment: 'Grade type (regular/revision/materia_pendiente/transferencia/equivalencia)',
    },
    editedBy: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: User_1.default, key: 'id' },
        comment: 'User who made the change',
    },
    editorRole: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: true,
        comment: 'Role context of the editor (teacher/control_estudios/admin/master)',
    },
    reason: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Reason for the edit, if provided',
    },
    actCode: {
        type: sequelize_1.DataTypes.STRING(100),
        allowNull: true,
        comment: 'Act code associated with the edit, if any',
    },
    metadata: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: true,
        comment: 'Additional context (personId, subjectId, gradeId, schoolPeriodId, sectionId, etc.)',
    },
    editedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
        comment: 'When the edit occurred',
    },
}, {
    sequelize: database_1.default,
    tableName: 'grade_change_logs',
    indexes: [
        { unique: false, fields: ['entityType', 'entityId'] },
        { unique: false, fields: ['editedBy'] },
        { unique: false, fields: ['editedAt'] },
        { unique: false, fields: ['gradeType'] },
    ],
});
exports.default = GradeChangeLog;
