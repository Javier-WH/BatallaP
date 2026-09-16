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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHealth = void 0;
const database_1 = __importDefault(require("../config/database.js"));
const getHealth = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Try to authenticate with the database
        yield database_1.default.authenticate();
        res.status(200).json({
            status: 'ok',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        const err = error;
        res.status(503).json({
            status: 'error',
            database: 'disconnected',
            error: err.code || 'ECONNREFUSED',
            message: 'No se pudo conectar a la base de datos',
            timestamp: new Date().toISOString()
        });
    }
});
exports.getHealth = getHealth;
