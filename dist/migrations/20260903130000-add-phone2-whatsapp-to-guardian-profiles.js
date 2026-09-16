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
    up(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            // Guard: columns may already exist if created by sequelize.sync() before
            // migrations ran.
            const tableDesc = yield queryInterface.describeTable('guardian_profiles');
            if (!tableDesc.phone2) {
                yield queryInterface.addColumn('guardian_profiles', 'phone2', {
                    type: sequelize_1.DataTypes.STRING,
                    allowNull: true,
                });
            }
            if (!tableDesc.whatsapp) {
                yield queryInterface.addColumn('guardian_profiles', 'whatsapp', {
                    type: sequelize_1.DataTypes.STRING,
                    allowNull: true,
                });
            }
        });
    },
    down(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            yield queryInterface.removeColumn('guardian_profiles', 'whatsapp');
            yield queryInterface.removeColumn('guardian_profiles', 'phone2');
        });
    }
};
