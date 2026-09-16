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
exports.default = {
    up: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        // Allow NULL for previousStatus in grade_edit_audits table
        yield queryInterface.changeColumn('grade_edit_audits', 'previousStatus', {
            type: sequelize_1.DataTypes.ENUM('aprobada', 'reprobada'),
            allowNull: true,
        });
    }),
    down: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        // Revert to NOT NULL for previousStatus
        yield queryInterface.changeColumn('grade_edit_audits', 'previousStatus', {
            type: sequelize_1.DataTypes.ENUM('aprobada', 'reprobada'),
            allowNull: false,
        });
    })
};
