"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Inscription_1 = __importDefault(require("./Inscription"));
const SubjectGroup_1 = __importDefault(require("./SubjectGroup"));
const Subject_1 = __importDefault(require("./Subject"));
const Term_1 = __importDefault(require("./Term"));
class InscriptionGroupTermChoice extends sequelize_1.Model {
}
InscriptionGroupTermChoice.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    inscriptionId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: Inscription_1.default, key: 'id' },
    },
    subjectGroupId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: SubjectGroup_1.default, key: 'id' },
    },
    termId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: Term_1.default, key: 'id' },
    },
    subjectId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: Subject_1.default, key: 'id' },
    },
}, {
    sequelize: database_1.default,
    tableName: 'inscription_group_term_choices',
    indexes: [
        // One subject per (student's group slot, term).
        { unique: true, fields: ['inscriptionId', 'subjectGroupId', 'termId'], name: 'igt_choice_unique' },
    ],
});
exports.default = InscriptionGroupTermChoice;
