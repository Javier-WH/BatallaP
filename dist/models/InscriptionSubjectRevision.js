"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const RevisionPeriod_1 = __importDefault(require("./RevisionPeriod"));
const InscriptionSubject_1 = __importDefault(require("./InscriptionSubject"));
const Person_1 = __importDefault(require("./Person"));
class InscriptionSubjectRevision extends sequelize_1.Model {
}
InscriptionSubjectRevision.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    revisionPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: RevisionPeriod_1.default,
            key: 'id',
        },
    },
    inscriptionSubjectId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: InscriptionSubject_1.default,
            key: 'id',
        },
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
    isAbsent: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    gradedBy: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: Person_1.default,
            key: 'id',
        },
    },
    gradedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
}, {
    sequelize: database_1.default,
    tableName: 'inscription_subject_revisions',
    indexes: [
        {
            unique: true,
            fields: ['revisionPeriodId', 'inscriptionSubjectId', 'opportunity'],
            name: 'uq_ins_subject_revision',
        },
    ],
});
exports.default = InscriptionSubjectRevision;
