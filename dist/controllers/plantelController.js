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
exports.deletePlantel = exports.updatePlantel = exports.createPlantel = exports.searchPlanteles = exports.getPlantel = exports.getPlantelById = exports.listPlanteles = void 0;
const index_1 = require("../models/index.js");
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
// Function to normalize text for search (remove accents, lowercase, remove special chars and spaces)
const normalizeText = (text) => {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (accents)
        .replace(/[^a-z0-9]/g, '') // Remove special characters and spaces
        .trim();
};
const listPlanteles = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { q, state, municipality, limit } = req.query;
        const parsedLimit = typeof limit === 'string' ? Number(limit) : undefined;
        const whereClause = {};
        if (q && typeof q === 'string') {
            whereClause[sequelize_1.Op.or] = [
                { name: { [sequelize_1.Op.like]: `%${q}%` } },
                { code: { [sequelize_1.Op.like]: `%${q}%` } }
            ];
        }
        if (state && typeof state === 'string') {
            whereClause.state = { [sequelize_1.Op.like]: `%${state}%` };
        }
        if (municipality && typeof municipality === 'string') {
            whereClause.municipality = { [sequelize_1.Op.like]: `%${municipality}%` };
        }
        const planteles = yield index_1.Plantel.findAll({
            where: whereClause,
            limit: parsedLimit,
            order: [['name', 'ASC']]
        });
        res.json(planteles);
    }
    catch (error) {
        console.error('Error listing planteles:', error);
        res.status(500).json({ error: 'Error obteniendo planteles' });
    }
});
exports.listPlanteles = listPlanteles;
const getPlantelById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const plantel = yield index_1.Plantel.findByPk(id);
        if (!plantel) {
            return res.status(404).json({ error: 'Plantel no encontrado' });
        }
        res.json(plantel);
    }
    catch (error) {
        console.error('Error retrieving plantel by id:', error);
        res.status(500).json({ error: 'Error obteniendo el plantel' });
    }
});
exports.getPlantelById = getPlantelById;
const getPlantel = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { code } = req.params;
        if (!code) {
            return res.status(400).json({ error: 'Debe indicar el código o nombre del plantel' });
        }
        const plantel = yield index_1.Plantel.findOne({
            where: {
                [sequelize_1.Op.or]: [
                    { code: code },
                    { name: code }
                ]
            }
        });
        if (!plantel) {
            return res.status(404).json({ error: 'Plantel no encontrado' });
        }
        res.json(plantel);
    }
    catch (error) {
        console.error('Error retrieving plantel:', error);
        res.status(500).json({ error: 'Error obteniendo el plantel' });
    }
});
exports.getPlantel = getPlantel;
const searchPlanteles = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { q, limit = 10 } = req.query;
        if (!q || typeof q !== 'string') {
            return res.status(400).json({ error: 'Se requiere parámetro de búsqueda "q"' });
        }
        const normalizedQuery = normalizeText(q);
        const searchConditions = [];
        // Primary search: case-insensitive matches
        searchConditions.push(database_1.default.literal(`LOWER(name) LIKE LOWER('%${q}%')`));
        searchConditions.push(database_1.default.literal(`LOWER(code) LIKE LOWER('%${q}%')`));
        searchConditions.push(database_1.default.literal(`LOWER(state) LIKE LOWER('%${q}%')`));
        // If we have a normalized query different from the original, add normalized search
        if (normalizedQuery && normalizedQuery !== q.toLowerCase()) {
            searchConditions.push(database_1.default.literal(`REPLACE(REPLACE(REPLACE(REPLACE(LOWER(name), 'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o') LIKE '%${normalizedQuery}%'`));
            searchConditions.push(database_1.default.literal(`REPLACE(REPLACE(REPLACE(REPLACE(LOWER(code), 'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o') LIKE '%${normalizedQuery}%'`));
            searchConditions.push(database_1.default.literal(`REPLACE(REPLACE(REPLACE(REPLACE(LOWER(state), 'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o') LIKE '%${normalizedQuery}%'`));
        }
        const planteles = yield index_1.Plantel.findAll({
            where: {
                [sequelize_1.Op.or]: searchConditions
            },
            limit: Number(limit),
            order: [['name', 'ASC']]
        });
        res.json(planteles);
    }
    catch (error) {
        console.error('Error searching planteles:', error);
        res.status(500).json({ error: 'Error buscando planteles' });
    }
});
exports.searchPlanteles = searchPlanteles;
const createPlantel = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { code, name, state, dependency, municipality, parish, stateCode } = req.body;
        const plantel = yield index_1.Plantel.create({
            code,
            name,
            state,
            dependency,
            municipality,
            parish,
            stateCode
            // stateCode is auto-generated by the beforeCreate hook if not provided
        });
        res.status(201).json(plantel);
    }
    catch (error) {
        console.error('Error creating plantel:', error);
        res.status(500).json({ error: 'Error creando plantel' });
    }
});
exports.createPlantel = createPlantel;
const updatePlantel = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { code, name, state, dependency, municipality, parish, stateCode } = req.body;
        const plantel = yield index_1.Plantel.findByPk(id);
        if (!plantel) {
            return res.status(404).json({ error: 'Plantel no encontrado' });
        }
        yield plantel.update({
            code,
            name,
            state,
            dependency,
            municipality,
            parish,
            stateCode
            // stateCode is auto-regenerated by the beforeUpdate hook when state changes
        });
        res.json(plantel);
    }
    catch (error) {
        console.error('Error updating plantel:', error);
        res.status(500).json({ error: 'Error actualizando plantel' });
    }
});
exports.updatePlantel = updatePlantel;
const deletePlantel = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const plantel = yield index_1.Plantel.findByPk(id);
        if (!plantel) {
            return res.status(404).json({ error: 'Plantel no encontrado' });
        }
        yield plantel.destroy();
        res.status(204).send();
    }
    catch (error) {
        console.error('Error deleting plantel:', error);
        res.status(500).json({ error: 'Error eliminando plantel' });
    }
});
exports.deletePlantel = deletePlantel;
