"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Qualification_1 = __importDefault(require("./Qualification"));
const User_1 = __importDefault(require("./User"));
class QualificationEditRequest extends sequelize_1.Model {
}
QualificationEditRequest.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    qualificationId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: Qualification_1.default, key: 'id' },
        comment: 'Qualification whose timer expired and teacher wants to edit',
    },
    requestedBy: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: { model: User_1.default, key: 'id' },
        comment: 'Teacher who requested permission to edit',
    },
    justification: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
        comment: 'Reason the teacher provides for needing to edit the locked grade',
    },
    currentScore: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Score at the time of the request',
    },
    requestedScore: {
        type: sequelize_1.DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Score the teacher wants to set',
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
    },
    reviewedBy: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: { model: User_1.default, key: 'id' },
        comment: 'Control de Estudios user who reviewed the request',
    },
    reviewedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
    },
    reviewNote: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true,
        comment: 'Optional note from the reviewer',
    },
    grantedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'When the edit permission was granted (upon approval)',
    },
}, {
    sequelize: database_1.default,
    tableName: 'qualification_edit_requests',
    indexes: [
        { unique: false, fields: ['qualificationId'] },
        { unique: false, fields: ['requestedBy'] },
        { unique: false, fields: ['status'] },
    ],
});
exports.default = QualificationEditRequest;
