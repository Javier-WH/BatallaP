"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const PendingSubject_1 = __importDefault(require("./PendingSubject"));
class PendingSubjectContent extends sequelize_1.Model {
}
PendingSubjectContent.init({
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
    themeTitle: {
        type: sequelize_1.DataTypes.STRING(500),
        allowNull: false,
        defaultValue: '',
    },
}, {
    sequelize: database_1.default,
    tableName: 'pending_subject_contents',
    indexes: [
        {
            unique: true,
            fields: ['pendingSubjectId'],
        },
    ],
});
exports.default = PendingSubjectContent;
