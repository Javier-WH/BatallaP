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
exports.replaceStudentPreviousSchools = exports.deleteStudentPreviousSchool = exports.updateStudentPreviousSchool = exports.createStudentPreviousSchool = exports.getStudentPreviousSchool = exports.listStudentPreviousSchools = void 0;
const database_1 = __importDefault(require("../config/database.js"));
const index_1 = require("../models/index.js");
const serialize = (record) => ({
    id: record.id,
    personId: record.personId,
    plantelCode: record.plantelCode,
    plantelName: record.plantelName,
    state: record.state,
    municipality: record.municipality,
    parish: record.parish,
    dependency: record.dependency,
    gradeFrom: record.gradeFrom,
    gradeTo: record.gradeTo,
    notes: record.notes,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
});
const listStudentPreviousSchools = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { personId } = req.query;
        const where = personId ? { personId: Number(personId) } : undefined;
        const records = yield index_1.StudentPreviousSchool.findAll({
            where,
            order: [['createdAt', 'DESC']]
        });
        res.json(records.map(serialize));
    }
    catch (error) {
        console.error('Error listing previous schools:', error);
        res.status(500).json({ error: 'Error al listar planteles previos' });
    }
});
exports.listStudentPreviousSchools = listStudentPreviousSchools;
const getStudentPreviousSchool = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const record = yield index_1.StudentPreviousSchool.findByPk(id);
        if (!record) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }
        res.json(serialize(record));
    }
    catch (error) {
        console.error('Error fetching previous school:', error);
        res.status(500).json({ error: 'Error obteniendo plantel previo' });
    }
});
exports.getStudentPreviousSchool = getStudentPreviousSchool;
const ensurePersonExists = (personId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!personId)
        return null;
    return index_1.Person.findByPk(personId);
});
const isValidPayload = (item) => Boolean(item.plantelName && item.plantelName.trim().length > 0);
const createStudentPreviousSchool = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    try {
        const { personId, plantelName } = req.body;
        if (!personId || !plantelName) {
            return res.status(400).json({ error: 'personId y plantelName son obligatorios' });
        }
        const person = yield ensurePersonExists(personId);
        if (!person) {
            return res.status(404).json({ error: 'Estudiante no encontrado' });
        }
        const record = yield index_1.StudentPreviousSchool.create({
            personId,
            plantelCode: (_a = req.body.plantelCode) !== null && _a !== void 0 ? _a : null,
            plantelName: plantelName.trim(),
            state: (_b = req.body.state) !== null && _b !== void 0 ? _b : null,
            municipality: (_c = req.body.municipality) !== null && _c !== void 0 ? _c : null,
            parish: (_d = req.body.parish) !== null && _d !== void 0 ? _d : null,
            dependency: (_e = req.body.dependency) !== null && _e !== void 0 ? _e : null,
            gradeFrom: (_f = req.body.gradeFrom) !== null && _f !== void 0 ? _f : null,
            gradeTo: (_g = req.body.gradeTo) !== null && _g !== void 0 ? _g : null,
            notes: (_h = req.body.notes) !== null && _h !== void 0 ? _h : null
        });
        res.status(201).json(serialize(record));
    }
    catch (error) {
        console.error('Error creating previous school:', error);
        res.status(500).json({ error: 'Error creando plantel previo' });
    }
});
exports.createStudentPreviousSchool = createStudentPreviousSchool;
const updateStudentPreviousSchool = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { plantelCode, plantelName, state, municipality, parish, dependency, gradeFrom, gradeTo, notes } = req.body;
        if (!plantelName || !plantelName.trim()) {
            return res.status(400).json({ error: 'El nombre del plantel es requerido' });
        }
        const record = yield index_1.StudentPreviousSchool.findByPk(id);
        if (!record) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }
        yield record.update({
            plantelCode: plantelCode || null,
            plantelName: plantelName.trim(),
            state: state || null,
            municipality: municipality || null,
            parish: parish || null,
            dependency: dependency || null,
            gradeFrom: gradeFrom || null,
            gradeTo: gradeTo || null,
            notes: notes || null
        });
        res.json(serialize(record));
    }
    catch (error) {
        console.error('Error actualizando plantel previo:', error);
        res.status(500).json({ error: 'Error actualizando plantel previo' });
    }
});
exports.updateStudentPreviousSchool = updateStudentPreviousSchool;
const deleteStudentPreviousSchool = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const record = yield index_1.StudentPreviousSchool.findByPk(id);
        if (!record) {
            return res.status(404).json({ error: 'Registro no encontrado' });
        }
        yield record.destroy();
        res.json({ message: 'Plantel previo eliminado correctamente' });
    }
    catch (error) {
        console.error('Error eliminando plantel previo:', error);
        res.status(500).json({ error: 'Error eliminando plantel previo' });
    }
});
exports.deleteStudentPreviousSchool = deleteStudentPreviousSchool;
const replaceStudentPreviousSchools = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const t = yield database_1.default.transaction();
    try {
        const { personId } = req.params;
        if (!personId) {
            yield t.rollback();
            return res.status(400).json({ error: 'Debe indicar el estudiante' });
        }
        const person = yield index_1.Person.findByPk(personId, { transaction: t, lock: t.LOCK.UPDATE });
        if (!person) {
            yield t.rollback();
            return res.status(404).json({ error: 'Estudiante no encontrado' });
        }
        const payload = Array.isArray(req.body) ? req.body : [];
        const sanitized = payload.filter(isValidPayload).map((item) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            return ({
                personId: Number(personId),
                plantelCode: (_a = item.plantelCode) !== null && _a !== void 0 ? _a : null,
                plantelName: (_c = (_b = item.plantelName) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : '',
                state: (_d = item.state) !== null && _d !== void 0 ? _d : null,
                municipality: (_e = item.municipality) !== null && _e !== void 0 ? _e : null,
                parish: (_f = item.parish) !== null && _f !== void 0 ? _f : null,
                dependency: (_g = item.dependency) !== null && _g !== void 0 ? _g : null,
                gradeFrom: (_h = item.gradeFrom) !== null && _h !== void 0 ? _h : null,
                gradeTo: (_j = item.gradeTo) !== null && _j !== void 0 ? _j : null,
                notes: (_k = item.notes) !== null && _k !== void 0 ? _k : null
            });
        });
        yield index_1.StudentPreviousSchool.destroy({ where: { personId }, transaction: t });
        if (sanitized.length > 0) {
            yield index_1.StudentPreviousSchool.bulkCreate(sanitized, { transaction: t });
        }
        yield t.commit();
        const updated = yield index_1.StudentPreviousSchool.findAll({
            where: { personId },
            order: [['createdAt', 'ASC']]
        });
        res.json(updated.map(serialize));
    }
    catch (error) {
        if (t)
            yield t.rollback();
        console.error('Error actualizando planteles previos:', error);
        res.status(500).json({ error: 'Error actualizando planteles previos' });
    }
});
exports.replaceStudentPreviousSchools = replaceStudentPreviousSchools;
