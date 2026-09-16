"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const EvaluationPlan_1 = __importDefault(require("./EvaluationPlan"));
const InscriptionSubject_1 = __importDefault(require("./InscriptionSubject"));
class Qualification extends sequelize_1.Model {
}
Qualification.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    evaluationPlanId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: EvaluationPlan_1.default, key: 'id' },
        allowNull: false
    },
    inscriptionSubjectId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: InscriptionSubject_1.default, key: 'id' },
        allowNull: false
    },
    score: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: false,
        validate: {
            min: 0
        }
    },
    remedialScore: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        validate: {
            min: 0
        }
    },
    isAbsent: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    observations: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true
    },
    schoolPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        comment: 'Denormalizado desde PeriodGrade.schoolPeriodId via EvaluationPlan',
    },
    termId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        comment: 'Denormalizado desde EvaluationPlan.termId',
    },
    subjectId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        comment: 'Denormalizado desde PeriodGradeSubject.subjectId via EvaluationPlan',
    },
    gradeId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        comment: 'Denormalizado desde PeriodGrade.gradeId via EvaluationPlan',
    },
    sectionId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        comment: 'Denormalizado desde EvaluationPlan.sectionId',
    },
    date: {
        type: sequelize_1.DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Denormalizado desde EvaluationPlan.date',
    },
    scoreSetAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp when the score was last set (for grade edit grace timer)',
    },
    remedialScoreSetAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Timestamp when the remedial score was last set (for grade edit grace timer)',
    }
}, {
    sequelize: database_1.default,
    tableName: 'qualifications',
    indexes: [
        {
            unique: true,
            fields: ['evaluationPlanId', 'inscriptionSubjectId'] // A student gets one score per evaluation item
        },
        {
            fields: ['schoolPeriodId', 'gradeId', 'subjectId', 'termId'],
            name: 'idx_qualifications_context',
        }
    ]
});
exports.default = Qualification;
