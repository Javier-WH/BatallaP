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
const ENUM_VALUES = ['regular', 'repitiente', 'materia_pendiente'];
module.exports = {
    up: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        yield queryInterface.addColumn('matriculations', 'escolaridad', {
            type: sequelize_1.DataTypes.ENUM(...ENUM_VALUES),
            allowNull: false,
            defaultValue: 'regular'
        });
        yield queryInterface.addColumn('inscriptions', 'escolaridad', {
            type: sequelize_1.DataTypes.ENUM(...ENUM_VALUES),
            allowNull: false,
            defaultValue: 'regular'
        });
        yield queryInterface.sequelize.query(`UPDATE matriculations SET escolaridad = 'regular' WHERE escolaridad IS NULL OR escolaridad = ''`);
        yield queryInterface.sequelize.query(`UPDATE inscriptions SET escolaridad = 'regular' WHERE escolaridad IS NULL OR escolaridad = ''`);
    }),
    down: (queryInterface) => __awaiter(void 0, void 0, void 0, function* () {
        yield queryInterface.removeColumn('inscriptions', 'escolaridad');
        yield queryInterface.removeColumn('matriculations', 'escolaridad');
        yield queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_matriculations_escolaridad\" CASCADE;");
        yield queryInterface.sequelize.query("DROP TYPE IF EXISTS \"enum_inscriptions_escolaridad\" CASCADE;");
    })
};
