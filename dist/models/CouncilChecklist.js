"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const SchoolPeriod_1 = __importDefault(require("./SchoolPeriod"));
const Grade_1 = __importDefault(require("./Grade"));
const Section_1 = __importDefault(require("./Section"));
const Term_1 = __importDefault(require("./Term"));
const User_1 = __importDefault(require("./User"));
class CouncilChecklist extends sequelize_1.Model {
}
CouncilChecklist.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    schoolPeriodId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: SchoolPeriod_1.default,
            key: 'id'
        }
    },
    gradeId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Grade_1.default,
            key: 'id'
        }
    },
    sectionId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Section_1.default,
            key: 'id'
        }
    },
    termId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: Term_1.default,
            key: 'id'
        }
    },
    status: {
        type: sequelize_1.DataTypes.ENUM('open', 'in_review', 'done'),
        allowNull: false,
        defaultValue: 'open'
    },
    completedBy: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: User_1.default,
            key: 'id'
        }
    },
    completedAt: {
        type: sequelize_1.DataTypes.DATE,
        allowNull: true
    }
}, {
    sequelize: database_1.default,
    tableName: 'council_checklists',
    indexes: [
        {
            unique: true,
            fields: ['schoolPeriodId', 'gradeId', 'sectionId', 'termId'],
            name: 'uq_council_checklists_scope'
        }
    ]
});
exports.default = CouncilChecklist;
