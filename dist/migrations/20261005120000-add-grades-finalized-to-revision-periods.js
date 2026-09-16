"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
module.exports = {
    up(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryInterface.addColumn('revision_periods', 'gradesFinalized', {
                type: sequelize_1.DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            });
            yield queryInterface.addColumn('revision_periods', 'gradesFinalizedAt', {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true,
            });
            yield queryInterface.addColumn('revision_periods', 'gradesFinalizedBy', {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
                references: { model: 'users', key: 'id' },
                onDelete: 'SET NULL',
            });
        });
    },
    down(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryInterface.removeColumn('revision_periods', 'gradesFinalizedBy');
            yield queryInterface.removeColumn('revision_periods', 'gradesFinalizedAt');
            yield queryInterface.removeColumn('revision_periods', 'gradesFinalized');
        });
    },
};
