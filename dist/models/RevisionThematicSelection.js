"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const RevisionPeriod_1 = __importDefault(require("./RevisionPeriod"));
const PeriodGradeSubject_1 = __importDefault(require("./PeriodGradeSubject"));
const Section_1 = __importDefault(require("./Section"));
class RevisionThematicSelection extends sequelize_1.Model {
}
RevisionThematicSelection.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    revisionPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: RevisionPeriod_1.default, key: 'id' },
    },
    periodGradeSubjectId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: PeriodGradeSubject_1.default, key: 'id' },
    },
    sectionId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: Section_1.default, key: 'id' },
    },
    thematicComponentIds: {
        type: sequelize_1.DataTypes.JSON,
        allowNull: true,
        defaultValue: null,
    },
}, {
    sequelize: database_1.default,
    tableName: 'revision_thematic_selections',
    indexes: [
        {
            unique: true,
            fields: ['revisionPeriodId', 'periodGradeSubjectId', 'sectionId'],
            name: 'uq_revision_thematic_selection',
        },
    ],
});
exports.default = RevisionThematicSelection;
