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
        // Allow NULL for phone1 and address in contacts table
        yield queryInterface.changeColumn('contacts', 'phone1', {
            type: sequelize_1.DataTypes.STRING,
            allowNull: true,
        });
        yield queryInterface.changeColumn('contacts', 'address', {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: true,
        });
    }),
    down: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        // Revert to NOT NULL for phone1 and address
        yield queryInterface.changeColumn('contacts', 'phone1', {
            type: sequelize_1.DataTypes.STRING,
            allowNull: false,
        });
        yield queryInterface.changeColumn('contacts', 'address', {
            type: sequelize_1.DataTypes.TEXT,
            allowNull: false,
        });
    })
};
