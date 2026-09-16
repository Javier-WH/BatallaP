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
        // 1. Add withdrawnAt to inscriptions
        yield queryInterface.addColumn('inscriptions', 'withdrawnAt', {
            type: sequelize_1.DataTypes.DATE,
            allowNull: true,
            defaultValue: null
        });
        // 2. Add 'withdrawn' to matriculations status ENUM
        // MySQL requires re-specifying the full ENUM
        yield queryInterface.changeColumn('matriculations', 'status', {
            type: sequelize_1.DataTypes.ENUM('pending', 'completed', 'withdrawn'),
            allowNull: false,
            defaultValue: 'pending'
        });
    }),
    down: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        // Revert matriculations status ENUM (remove 'withdrawn')
        yield queryInterface.changeColumn('matriculations', 'status', {
            type: sequelize_1.DataTypes.ENUM('pending', 'completed'),
            allowNull: false,
            defaultValue: 'pending'
        });
        yield queryInterface.removeColumn('inscriptions', 'withdrawnAt');
    })
};
