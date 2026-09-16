"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const PendingSubject_1 = __importDefault(require("./PendingSubject"));
class PendingSubjectEncounter extends sequelize_1.Model {
}
PendingSubjectEncounter.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    pendingSubjectId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: PendingSubject_1.default,
            key: 'id',
        },
    },
    encounterNumber: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1,
        },
    },
    date: {
        type: sequelize_1.DataTypes.DATEONLY,
        allowNull: true,
        defaultValue: null,
    },
    score: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
        validate: {
            min: 0,
            max: 20,
        },
    },
    isAbsent: {
        type: sequelize_1.DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
}, {
    sequelize: database_1.default,
    tableName: 'pending_subject_encounters',
    indexes: [
        {
            unique: true,
            fields: ['pendingSubjectId', 'encounterNumber'],
        },
    ],
});
exports.default = PendingSubjectEncounter;
