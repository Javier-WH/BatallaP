"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const InscriptionSubject_1 = __importDefault(require("./InscriptionSubject"));
const Term_1 = __importDefault(require("./Term"));
class CouncilPoint extends sequelize_1.Model {
}
CouncilPoint.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    inscriptionSubjectId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: InscriptionSubject_1.default, key: 'id' },
        allowNull: false
    },
    termId: {
        type: sequelize_1.DataTypes.INTEGER,
        references: { model: Term_1.default, key: 'id' },
        allowNull: false
    },
    points: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    observations: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: true
    }
}, {
    sequelize: database_1.default,
    tableName: 'council_points',
    indexes: [
        {
            unique: true,
            fields: ['inscriptionSubjectId', 'termId']
        }
    ]
});
exports.default = CouncilPoint;
