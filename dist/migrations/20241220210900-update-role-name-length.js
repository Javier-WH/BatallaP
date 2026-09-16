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
    up: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        yield queryInterface.changeColumn('roles', 'name', {
            type: sequelize_1.DataTypes.STRING(30), // Increased from default length to accommodate longer role names
            allowNull: false,
            unique: true
        });
    }),
    down: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        // Revert to the original column definition if needed
        yield queryInterface.changeColumn('roles', 'name', {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
            unique: true
        });
    })
};
