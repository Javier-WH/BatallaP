"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const InscriptionSubject_1 = __importDefault(require("./InscriptionSubject"));
const Plantel_1 = __importDefault(require("./Plantel"));
class SubjectFinalGrade extends sequelize_1.Model {
}
SubjectFinalGrade.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    inscriptionSubjectId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: InscriptionSubject_1.default,
            key: 'id'
        }
    },
    finalScore: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    originalScore: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    originalStatus: {
        type: sequelize_1.DataTypes.ENUM('aprobada', 'reprobada'),
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
    plantelId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: Plantel_1.default,
            key: 'id'
        }
    },
    gradeType: {
        type: sequelize_1.DataTypes.ENUM('regular', 'revision', 'materia_pendiente', 'revision_materia_pendiente', 'transferencia', 'equivalencia'),
        allowNull: true,
        defaultValue: 'regular'
    },
    schoolPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        comment: 'Denormalizado desde Inscription.schoolPeriodId via InscriptionSubject',
    },
    subjectId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        comment: 'Denormalizado desde InscriptionSubject.subjectId',
    },
    gradeId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        comment: 'Denormalizado desde Inscription.gradeId via InscriptionSubject',
    },
    termId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        comment: 'Lapso al que pertenece la nota (solo para revisiones; NULL para notas finales regulares)',
    }
}, {
    sequelize: database_1.default,
    tableName: 'subject_final_grades',
    indexes: [
        {
            unique: true,
            fields: ['inscriptionSubjectId', 'gradeType'],
            name: 'idx_subject_final_grades_inssub_gradetype',
        },
        {
            fields: ['schoolPeriodId', 'gradeId', 'subjectId'],
            name: 'idx_subject_final_grades_context',
        }
    ]
});
exports.default = SubjectFinalGrade;
