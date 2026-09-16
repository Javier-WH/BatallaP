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
exports.saveGridState = exports.getGridState = exports.deleteAssignment = exports.createAssignment = exports.listAssignments = void 0;
const models_1 = require("../models/index.js");
// GET /api/classroom-assignments
const listAssignments = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const assignments = yield models_1.ClassroomAssignment.findAll({
            include: [{ model: models_1.Subject, as: 'subject', attributes: ['id', 'name'], required: false }],
        });
        return res.json(assignments);
    }
    catch (error) {
        console.error('[listAssignments] Error:', error);
        return res.status(500).json({ message: 'Error al listar asignaciones de aulas' });
    }
});
exports.listAssignments = listAssignments;
// POST /api/classroom-assignments
const createAssignment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { room, targetType, sectionKey, subjectId, gradeId } = req.body;
        if (!room || !targetType)
            return res.status(400).json({ message: 'room y targetType son requeridos' });
        if (targetType === 'section' && !sectionKey)
            return res.status(400).json({ message: 'sectionKey es requerido para targetType=section' });
        if (targetType === 'subject' && !subjectId)
            return res.status(400).json({ message: 'subjectId es requerido para targetType=subject' });
        if (targetType === 'group' && (!subjectId || gradeId == null))
            return res.status(400).json({ message: 'subjectId y gradeId son requeridos para targetType=group' });
        const [assignment, created] = yield models_1.ClassroomAssignment.findOrCreate({
            where: { room, targetType, sectionKey: sectionKey !== null && sectionKey !== void 0 ? sectionKey : null, subjectId: subjectId !== null && subjectId !== void 0 ? subjectId : null, gradeId: gradeId !== null && gradeId !== void 0 ? gradeId : null },
            defaults: { room, targetType, sectionKey: sectionKey !== null && sectionKey !== void 0 ? sectionKey : null, subjectId: subjectId !== null && subjectId !== void 0 ? subjectId : null, gradeId: gradeId !== null && gradeId !== void 0 ? gradeId : null },
        });
        return res.status(created ? 201 : 200).json(assignment);
    }
    catch (error) {
        console.error('[createAssignment] Error:', error);
        return res.status(500).json({ message: 'Error al crear asignación' });
    }
});
exports.createAssignment = createAssignment;
// DELETE /api/classroom-assignments/:id
const deleteAssignment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield models_1.ClassroomAssignment.destroy({ where: { id: Number(id) } });
        return res.json({ message: 'Asignación eliminada' });
    }
    catch (error) {
        console.error('[deleteAssignment] Error:', error);
        return res.status(500).json({ message: 'Error al eliminar asignación' });
    }
});
exports.deleteAssignment = deleteAssignment;
// GET /api/classroom-assignments/grid/:schoolPeriodId — load saved grid state
const getGridState = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { schoolPeriodId } = req.params;
        const setting = yield models_1.Setting.findByPk(`classroom_grid_${schoolPeriodId}`);
        if (!setting)
            return res.json({});
        return res.json(JSON.parse(setting.value));
    }
    catch (error) {
        console.error('[getGridState] Error:', error);
        return res.status(500).json({ message: 'Error al cargar la distribución' });
    }
});
exports.getGridState = getGridState;
// PUT /api/classroom-assignments/grid/:schoolPeriodId — save grid state
const saveGridState = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { schoolPeriodId } = req.params;
        const data = JSON.stringify(req.body);
        yield models_1.Setting.upsert({ key: `classroom_grid_${schoolPeriodId}`, value: data });
        return res.json({ message: 'Distribución guardada' });
    }
    catch (error) {
        console.error('[saveGridState] Error:', error);
        return res.status(500).json({ message: 'Error al guardar la distribución' });
    }
});
exports.saveGridState = saveGridState;
