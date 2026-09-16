"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const Inscription_1 = __importDefault(require("./Inscription"));
const Subject_1 = __importDefault(require("./Subject"));
const SchoolPeriod_1 = __importDefault(require("./SchoolPeriod"));
class PendingSubject extends sequelize_1.Model {
}
PendingSubject.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    newInscriptionId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Inscription_1.default,
            key: 'id'
        }
    },
    subjectId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Subject_1.default,
            key: 'id'
        }
    },
    originPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: SchoolPeriod_1.default,
            key: 'id'
        }
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('pendiente', 'aprobada', 'convalidada'),
        allowNull: false,
        defaultValue: 'pendiente'
    },
    resolvedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true
    }
}, {
    sequelize: database_1.default,
    tableName: 'pending_subjects',
    indexes: [
        {
            unique: true,
            fields: ['newInscriptionId', 'subjectId']
        }
    ]
});
exports.default = PendingSubject;
