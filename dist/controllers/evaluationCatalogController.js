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
exports.mergeCatalogs = exports.deleteCatalog = exports.updateCatalog = exports.createCatalog = exports.getCatalogs = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const index_1 = require("../models/index.js");
const getCatalogs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { type } = req.query;
        const where = {};
        if (type && ['tecnica', 'instrumento', 'estrategia'].includes(type)) {
            where.type = type;
        }
        const catalogs = yield index_1.EvaluationCatalog.findAll({ where, order: [['name', 'ASC']] });
        res.json(catalogs);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al obtener catálogos' });
    }
});
exports.getCatalogs = getCatalogs;
const createCatalog = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { type, name } = req.body;
        if (!type || !['tecnica', 'instrumento', 'estrategia'].includes(type)) {
            return res.status(400).json({ message: 'Tipo inválido (debe ser "tecnica", "instrumento" o "estrategia")' });
        }
        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'El nombre es requerido' });
        }
        const existing = yield index_1.EvaluationCatalog.findOne({ where: { type, name: name.trim() } });
        if (existing) {
            return res.status(409).json({ message: 'Ya existe un registro con ese nombre' });
        }
        const catalog = yield index_1.EvaluationCatalog.create({ type, name: name.trim() });
        res.status(201).json(catalog);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al crear catálogo' });
    }
});
exports.createCatalog = createCatalog;
const updateCatalog = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'El nombre es requerido' });
        }
        const catalog = yield index_1.EvaluationCatalog.findByPk(Number(id));
        if (!catalog) {
            return res.status(404).json({ message: 'Catálogo no encontrado' });
        }
        const existing = yield index_1.EvaluationCatalog.findOne({
            where: { type: catalog.type, name: name.trim(), id: { $ne: Number(id) } }
        });
        if (existing) {
            return res.status(409).json({ message: 'Ya existe un registro con ese nombre' });
        }
        catalog.name = name.trim();
        yield catalog.save();
        res.json(catalog);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al actualizar catálogo' });
    }
});
exports.updateCatalog = updateCatalog;
const deleteCatalog = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const catalog = yield index_1.EvaluationCatalog.findByPk(Number(id));
        if (!catalog) {
            return res.status(404).json({ message: 'Catálogo no encontrado' });
        }
        yield catalog.destroy();
        res.json({ message: 'Catálogo eliminado' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al eliminar catálogo' });
    }
});
exports.deleteCatalog = deleteCatalog;
const mergeCatalogs = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { type, name, ids } = req.body;
        if (!type || !['tecnica', 'instrumento', 'estrategia'].includes(type)) {
            return res.status(400).json({ message: 'Tipo inválido' });
        }
        if (!name || !name.trim()) {
            return res.status(400).json({ message: 'El nombre es requerido' });
        }
        if (!Array.isArray(ids) || ids.length < 2) {
            return res.status(400).json({ message: 'Debe seleccionar al menos 2 registros para fusionar' });
        }
        const records = yield index_1.EvaluationCatalog.findAll({ where: { id: { [sequelize_1.Op.in]: ids }, type } });
        if (records.length !== ids.length) {
            return res.status(400).json({ message: 'Algunos registros no existen o no coincen con el tipo' });
        }
        const trimmedName = name.trim();
        const existing = yield index_1.EvaluationCatalog.findOne({ where: { type, name: trimmedName, id: { [sequelize_1.Op.notIn]: ids } } });
        if (existing) {
            return res.status(409).json({ message: 'Ya existe un registro con ese nombre' });
        }
        const t = yield database_1.default.transaction();
        try {
            const newCatalog = yield index_1.EvaluationCatalog.create({ type, name: trimmedName }, { transaction: t });
            const fkMap = {
                tecnica: 'tecnicaId',
                instrumento: 'instrumentoId',
                estrategia: 'estrategiaId',
            };
            const fkColumn = fkMap[type];
            yield index_1.EvaluationPlan.update({ [fkColumn]: newCatalog.id }, { where: { [fkColumn]: { [sequelize_1.Op.in]: ids } }, transaction: t });
            yield index_1.EvaluationCatalog.destroy({ where: { id: { [sequelize_1.Op.in]: ids } }, transaction: t });
            yield t.commit();
            res.status(201).json(newCatalog);
        }
        catch (error) {
            yield t.rollback();
            throw error;
        }
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error al fusionar catálogos' });
    }
});
exports.mergeCatalogs = mergeCatalogs;
