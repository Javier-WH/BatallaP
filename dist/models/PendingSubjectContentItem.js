"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const PendingSubjectContent_1 = __importDefault(require("./PendingSubjectContent"));
class PendingSubjectContentItem extends sequelize_1.Model {
}
PendingSubjectContentItem.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    contentId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: PendingSubjectContent_1.default,
            key: 'id',
        },
    },
    text: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
    },
    order: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
}, {
    sequelize: database_1.default,
    tableName: 'pending_subject_content_items',
});
exports.default = PendingSubjectContentItem;
