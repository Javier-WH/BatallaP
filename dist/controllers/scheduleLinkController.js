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
exports.deleteLink = exports.createLink = exports.listLinks = void 0;
const database_1 = __importDefault(require("../config/database.js"));
const models_1 = require("../models/index.js");
// GET /api/schedule-links?schoolPeriodId=
const listLinks = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { schoolPeriodId } = req.query;
        const where = {};
        if (schoolPeriodId)
            where.schoolPeriodId = Number(schoolPeriodId);
        const links = yield models_1.ScheduleLink.findAll({
            where,
            include: [
                {
                    model: models_1.ScheduleLinkItem,
                    as: 'items',
                    include: [
                        { model: models_1.Subject, as: 'subject', attributes: ['id', 'name', 'color'] },
                        { model: models_1.PeriodGrade, as: 'periodGrade', include: [{ model: models_1.Grade, as: 'grade', attributes: ['id', 'name'] }] },
                    ],
                },
            ],
            order: [['id', 'ASC']],
        });
        return res.json(links);
    }
    catch (error) {
        console.error('[listLinks] Error:', error);
        return res.status(500).json({ message: 'Error al listar vínculos de horarios' });
    }
});
exports.listLinks = listLinks;
// POST /api/schedule-links
const createLink = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, schoolPeriodId, items } = req.body;
        if (!schoolPeriodId)
            return res.status(400).json({ message: 'schoolPeriodId es requerido' });
        if (!items || items.length < 2) {
            return res.status(400).json({ message: 'Se requieren al menos 2 materias para crear un vínculo' });
        }
        // Validate no duplicate (subjectId, periodGradeId) pairs within the request
        const seen = new Set();
        for (const item of items) {
            const key = `${item.subjectId}|${item.periodGradeId}`;
            if (seen.has(key)) {
                return res.status(400).json({ message: `Par duplicado en la solicitud: subjectId=${item.subjectId}, periodGradeId=${item.periodGradeId}` });
            }
            seen.add(key);
        }
        // Validate that all periodGrades belong to the given school period
        const periodGrades = yield models_1.PeriodGrade.findAll({
            where: { id: items.map(i => i.periodGradeId) },
            attributes: ['id', 'schoolPeriodId'],
        });
        const pgPeriod = new Map(periodGrades.map(pg => [pg.id, pg.schoolPeriodId]));
        for (const item of items) {
            if (pgPeriod.get(item.periodGradeId) !== Number(schoolPeriodId)) {
                return res.status(400).json({ message: `El grado (periodGradeId=${item.periodGradeId}) no pertenece al período indicado` });
            }
        }
        // Validate that all subjects are group subjects (the feature only applies to group subjects)
        const subjects = yield models_1.Subject.findAll({
            where: { id: items.map(i => i.subjectId) },
            attributes: ['id', 'subjectGroupId'],
        });
        const subjectGroup = new Map(subjects.map(s => [s.id, s.subjectGroupId]));
        for (const item of items) {
            if (!subjectGroup.has(item.subjectId)) {
                return res.status(400).json({ message: `La materia (subjectId=${item.subjectId}) no existe` });
            }
            if (subjectGroup.get(item.subjectId) == null) {
                return res.status(400).json({ message: `La materia (subjectId=${item.subjectId}) no es una materia de grupo` });
            }
        }
        // Validate that none of the (subjectId, periodGradeId) pairs already belong to another link
        const existingItems = yield models_1.ScheduleLinkItem.findAll({
            where: {
                subjectId: items.map(i => i.subjectId),
                periodGradeId: items.map(i => i.periodGradeId),
            },
        });
        const existingSet = new Set(existingItems.map(i => `${i.subjectId}|${i.periodGradeId}`));
        for (const item of items) {
            const key = `${item.subjectId}|${item.periodGradeId}`;
            if (existingSet.has(key)) {
                return res.status(400).json({
                    message: `La materia (subjectId=${item.subjectId}, periodGradeId=${item.periodGradeId}) ya pertenece a otro vínculo`,
                });
            }
        }
        const t = yield database_1.default.transaction();
        try {
            const link = yield models_1.ScheduleLink.create({ name: name !== null && name !== void 0 ? name : null, schoolPeriodId }, { transaction: t });
            yield models_1.ScheduleLinkItem.bulkCreate(items.map(item => ({ linkId: link.id, subjectId: item.subjectId, periodGradeId: item.periodGradeId })), { transaction: t });
            yield t.commit();
            // Reload with associations for the response
            const fullLink = yield models_1.ScheduleLink.findByPk(link.id, {
                include: [
                    {
                        model: models_1.ScheduleLinkItem,
                        as: 'items',
                        include: [
                            { model: models_1.Subject, as: 'subject', attributes: ['id', 'name', 'color'] },
                            { model: models_1.PeriodGrade, as: 'periodGrade', include: [{ model: models_1.Grade, as: 'grade', attributes: ['id', 'name'] }] },
                        ],
                    },
                ],
            });
            return res.status(201).json(fullLink);
        }
        catch (err) {
            yield t.rollback();
            throw err;
        }
    }
    catch (error) {
        console.error('[createLink] Error:', error);
        return res.status(500).json({ message: 'Error al crear vínculo de horario' });
    }
});
exports.createLink = createLink;
// DELETE /api/schedule-links/:id
const deleteLink = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const link = yield models_1.ScheduleLink.findByPk(Number(id));
        if (!link)
            return res.status(404).json({ message: 'Vínculo no encontrado' });
        yield link.destroy(); // CASCADE deletes items
        return res.json({ message: 'Vínculo eliminado' });
    }
    catch (error) {
        console.error('[deleteLink] Error:', error);
        return res.status(500).json({ message: 'Error al eliminar vínculo de horario' });
    }
});
exports.deleteLink = deleteLink;
