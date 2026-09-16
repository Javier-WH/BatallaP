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
            // Change allowConsecutiveBlocks from BOOLEAN to INTEGER (0/1/2)
            const subjDesc = yield queryInterface.describeTable('subjects');
            if (subjDesc.allowConsecutiveBlocks) {
                // In MySQL, changing from BOOLEAN (TINYINT) to INTEGER is straightforward.
                // Existing true values become 1, false become 0.
                yield queryInterface.changeColumn('subjects', 'allowConsecutiveBlocks', {
                    type: sequelize_1.DataTypes.INTEGER,
                    allowNull: false,
                    defaultValue: 0,
                });
            }
        });
    },
    down(queryInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            const subjDesc = yield queryInterface.describeTable('subjects');
            if (subjDesc.allowConsecutiveBlocks) {
                yield queryInterface.changeColumn('subjects', 'allowConsecutiveBlocks', {
                    type: sequelize_1.DataTypes.BOOLEAN,
                    allowNull: false,
                    defaultValue: false,
                });
            }
        });
    },
};
