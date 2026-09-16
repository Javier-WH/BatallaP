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
        const transaction = yield queryInterface.sequelize.transaction();
        try {
            // Add columns to people
            yield queryInterface.addColumn('people', 'pathology', {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: true
            }, { transaction });
            yield queryInterface.addColumn('people', 'livingWith', {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true
            }, { transaction });
            // Add columns to guardian_profiles
            yield queryInterface.addColumn('guardian_profiles', 'occupation', {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true
            }, { transaction });
            // Add columns to person_residences
            yield queryInterface.addColumn('person_residences', 'address', {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: true
            }, { transaction });
            yield transaction.commit();
        }
        catch (error) {
            yield transaction.rollback();
            throw error;
        }
    }),
    down: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        const transaction = yield queryInterface.sequelize.transaction();
        try {
            yield queryInterface.removeColumn('people', 'pathology', { transaction });
            yield queryInterface.removeColumn('people', 'livingWith', { transaction });
            yield queryInterface.removeColumn('guardian_profiles', 'occupation', { transaction });
            yield queryInterface.removeColumn('person_residences', 'address', { transaction });
            yield transaction.commit();
        }
        catch (error) {
            yield transaction.rollback();
            throw error;
        }
    })
};
