"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Qualification_1 = __importDefault(require("./Qualification"));
const User_1 = __importDefault(require("./User"));
class QualificationAudit extends sequelize_1.Model {
}
QualificationAudit.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    qualificationId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: Qualification_1.default, key: 'id' },
    },
    editedBy: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: User_1.default, key: 'id' },
    },
    previousScore: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
    },
    newScore: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: false,
    },
    comment: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
    },
    editedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
    },
    editorContext: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
}, {
    sequelize: database_1.default,
    tableName: 'qualification_audits',
});
exports.default = QualificationAudit;
