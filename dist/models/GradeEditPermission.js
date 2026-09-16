"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const SchoolPeriod_1 = __importDefault(require("./SchoolPeriod"));
const User_1 = __importDefault(require("./User"));
class GradeEditPermission extends sequelize_1.Model {
}
GradeEditPermission.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    schoolPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: SchoolPeriod_1.default,
            key: 'id',
        },
        comment: 'Null = permiso global para todos los períodos',
    },
    grantedBy: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User_1.default,
            key: 'id',
        },
        comment: 'Administrador que otorgó el permiso',
    },
    grantedTo: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: User_1.default,
            key: 'id',
        },
        comment: 'Usuario de Control de Estudios receptor del permiso',
    },
    actCode: {
        type: sequelize_1.DataTypes.STRING(50),
        allowNull: false,
        comment: 'Código de acta que justifica el permiso',
    },
    observations: {
        type: sequelize_1.DataTypes.TEXT,
        allowNull: false,
        comment: 'Observaciones sobre el permiso otorgado',
    },
    isActive: {
        type: sequelize_1.DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Indica si el permiso está activo',
    },
    grantedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize_1.DataTypes.NOW,
        comment: 'Fecha y hora cuando se otorgó el permiso',
    },
    revokedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha y hora cuando se revocó el permiso',
    },
    revokedBy: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: User_1.default,
            key: 'id',
        },
        comment: 'Administrador que revocó el permiso',
    },
}, {
    sequelize: database_1.default,
    tableName: 'grade_edit_permissions',
    indexes: [
        {
            unique: false,
            fields: ['schoolPeriodId', 'grantedTo'],
        },
        {
            unique: false,
            fields: ['grantedTo'],
        },
        {
            unique: false,
            fields: ['isActive'],
        },
    ],
});
exports.default = GradeEditPermission;
