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
exports.deleteExpectedLearning = exports.updateExpectedLearning = exports.createExpectedLearning = exports.reorderThematicContents = exports.deleteThematicContent = exports.updateThematicContent = exports.createThematicContent = exports.reorderThematicComponents = exports.deleteThematicComponent = exports.updateThematicComponent = exports.createThematicComponent = exports.getThematicComponents = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const index_1 = require("../models/index.js");
// ── Thematic Components ──────────────────────────────────────────
const getThematicComponents = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { pgsId, termId } = req.query;
        if (!pgsId || !termId) {
            return res.status(400).json({ message: 'pgsId, termId son requeridos' });
        }
        const components = yield index_1.ThematicComponent.findAll({
            where: {
                periodGradeSubjectId: Number(pgsId),
                termId: Number(termId),
            },
            include: [
                {
                    association: 'contents',
                    include: [{ association: 'learnings' }],
                },
            ],
            order: [['order', 'ASC'], ['id', 'ASC']],
        });
        return res.json(components);
    }
    catch (error) {
        console.error('[getThematicComponents] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al obtener componentes' });
    }
});
exports.getThematicComponents = getThematicComponents;
const createThematicComponent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodGradeSubjectId, termId, title } = req.body;
        if (!periodGradeSubjectId || !termId || !title) {
            return res.status(400).json({ message: 'Faltan campos requeridos' });
        }
        const maxOrder = (yield index_1.ThematicComponent.max('order', {
            where: { periodGradeSubjectId, termId },
        })) || 0;
        const component = yield index_1.ThematicComponent.create({
            periodGradeSubjectId,
            termId,
            title,
            order: maxOrder + 1,
        });
        return res.status(201).json(component);
    }
    catch (error) {
        console.error('[createThematicComponent] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al crear componente' });
    }
});
exports.createThematicComponent = createThematicComponent;
const updateThematicComponent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { title, order } = req.body;
        const component = yield index_1.ThematicComponent.findByPk(Number(id));
        if (!component) {
            return res.status(404).json({ message: 'Componente no encontrado' });
        }
        yield component.update(Object.assign(Object.assign({}, (title !== undefined && { title })), (order !== undefined && { order })));
        return res.json(component);
    }
    catch (error) {
        console.error('[updateThematicComponent] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al actualizar' });
    }
});
exports.updateThematicComponent = updateThematicComponent;
const deleteThematicComponent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const component = yield index_1.ThematicComponent.findByPk(Number(id));
        if (!component) {
            return res.status(404).json({ message: 'Componente no encontrado' });
        }
        // Cascade delete: contents and their learning associations
        const contents = yield index_1.ThematicContent.findAll({ where: { thematicComponentId: Number(id) } });
        const contentIds = contents.map(c => c.id);
        if (contentIds.length > 0) {
            yield index_1.ExpectedLearningContent.destroy({ where: { contentId: contentIds } });
        }
        yield index_1.ThematicContent.destroy({ where: { thematicComponentId: Number(id) } });
        yield component.destroy();
        return res.json({ message: 'Componente eliminado' });
    }
    catch (error) {
        console.error('[deleteThematicComponent] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al eliminar' });
    }
});
exports.deleteThematicComponent = deleteThematicComponent;
const reorderThematicComponents = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { componentIds } = req.body;
    if (!Array.isArray(componentIds) || componentIds.length === 0 || componentIds.some((id) => typeof id !== 'number')) {
        return res.status(400).json({ message: 'Debe enviar un arreglo de IDs de componentes en el orden deseado.' });
    }
    const transaction = yield database_1.default.transaction();
    try {
        const components = yield index_1.ThematicComponent.findAll({
            where: { id: { [sequelize_1.Op.in]: componentIds } },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (components.length !== componentIds.length) {
            throw new Error('Alguno de los componentes no existe.');
        }
        // All components must belong to the same periodGradeSubject+term
        const keys = new Set(components.map((c) => `${c.periodGradeSubjectId}-${c.termId}`));
        if (keys.size !== 1) {
            throw new Error('Los componentes deben pertenecer al mismo lapso y asignación.');
        }
        const sortPosition = new Map(componentIds.map((componentId, index) => [componentId, index + 1]));
        for (const component of components) {
            const nextOrder = sortPosition.get(component.id);
            if (nextOrder !== undefined) {
                component.order = nextOrder;
                yield component.save({ transaction });
            }
        }
        yield transaction.commit();
        const { periodGradeSubjectId, termId } = components[0];
        const refreshed = yield index_1.ThematicComponent.findAll({
            where: { periodGradeSubjectId, termId },
            include: [
                {
                    association: 'contents',
                    include: [{ association: 'learnings' }],
                },
            ],
            order: [['order', 'ASC'], ['id', 'ASC']],
        });
        return res.json(refreshed);
    }
    catch (error) {
        yield transaction.rollback();
        console.error('[reorderThematicComponents] Error:', error);
        return res.status(400).json({ message: error.message || 'No se pudo reordenar' });
    }
});
exports.reorderThematicComponents = reorderThematicComponents;
// ── Thematic Contents ────────────────────────────────────────────
const createThematicContent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params; // thematicComponentId
        const { title } = req.body;
        if (!title) {
            return res.status(400).json({ message: 'title es requerido' });
        }
        const component = yield index_1.ThematicComponent.findByPk(Number(id));
        if (!component) {
            return res.status(404).json({ message: 'Componente no encontrado' });
        }
        const maxOrder = (yield index_1.ThematicContent.max('order', {
            where: { thematicComponentId: Number(id) },
        })) || 0;
        const content = yield index_1.ThematicContent.create({
            thematicComponentId: Number(id),
            title,
            order: maxOrder + 1,
        });
        return res.status(201).json(content);
    }
    catch (error) {
        console.error('[createThematicContent] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al crear contenido' });
    }
});
exports.createThematicContent = createThematicContent;
const updateThematicContent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { title, order } = req.body;
        const content = yield index_1.ThematicContent.findByPk(Number(id));
        if (!content) {
            return res.status(404).json({ message: 'Contenido no encontrado' });
        }
        yield content.update(Object.assign(Object.assign({}, (title !== undefined && { title })), (order !== undefined && { order })));
        return res.json(content);
    }
    catch (error) {
        console.error('[updateThematicContent] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al actualizar' });
    }
});
exports.updateThematicContent = updateThematicContent;
const deleteThematicContent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const content = yield index_1.ThematicContent.findByPk(Number(id));
        if (!content) {
            return res.status(404).json({ message: 'Contenido no encontrado' });
        }
        yield index_1.ExpectedLearningContent.destroy({ where: { contentId: Number(id) } });
        yield content.destroy();
        return res.json({ message: 'Contenido eliminado' });
    }
    catch (error) {
        console.error('[deleteThematicContent] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al eliminar' });
    }
});
exports.deleteThematicContent = deleteThematicContent;
const reorderThematicContents = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { contentIds } = req.body;
    if (!Array.isArray(contentIds) || contentIds.length === 0 || contentIds.some((id) => typeof id !== 'number')) {
        return res.status(400).json({ message: 'Debe enviar un arreglo de IDs de contenidos en el orden deseado.' });
    }
    const transaction = yield database_1.default.transaction();
    try {
        const contents = yield index_1.ThematicContent.findAll({
            where: { id: { [sequelize_1.Op.in]: contentIds } },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (contents.length !== contentIds.length) {
            throw new Error('Alguno de los contenidos no existe.');
        }
        // All contents must belong to the same thematic component
        const componentIds = new Set(contents.map((c) => c.thematicComponentId));
        if (componentIds.size !== 1) {
            throw new Error('Los contenidos deben pertenecer al mismo componente temático.');
        }
        const sortPosition = new Map(contentIds.map((contentId, index) => [contentId, index + 1]));
        for (const content of contents) {
            const nextOrder = sortPosition.get(content.id);
            if (nextOrder !== undefined) {
                content.order = nextOrder;
                yield content.save({ transaction });
            }
        }
        yield transaction.commit();
        const componentId = contents[0].thematicComponentId;
        const refreshed = yield index_1.ThematicContent.findAll({
            where: { thematicComponentId: componentId },
            order: [['order', 'ASC'], ['id', 'ASC']],
        });
        return res.json(refreshed);
    }
    catch (error) {
        yield transaction.rollback();
        console.error('[reorderThematicContents] Error:', error);
        return res.status(400).json({ message: error.message || 'No se pudo reordenar' });
    }
});
exports.reorderThematicContents = reorderThematicContents;
// ── Expected Learnings ───────────────────────────────────────────
const createExpectedLearning = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { contentIds, description } = req.body;
        if (!description) {
            return res.status(400).json({ message: 'description es requerido' });
        }
        if (!contentIds || !Array.isArray(contentIds) || contentIds.length === 0) {
            return res.status(400).json({ message: 'contentIds es requerido' });
        }
        const maxOrder = (yield index_1.ExpectedLearning.max('order')) || 0;
        const learning = yield index_1.ExpectedLearning.create({
            description,
            order: maxOrder + 1,
        });
        yield learning.setContents(contentIds);
        return res.status(201).json(learning);
    }
    catch (error) {
        console.error('[createExpectedLearning] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al crear aprendizaje' });
    }
});
exports.createExpectedLearning = createExpectedLearning;
const updateExpectedLearning = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { description, order, contentIds } = req.body;
        const learning = yield index_1.ExpectedLearning.findByPk(Number(id));
        if (!learning) {
            return res.status(404).json({ message: 'Aprendizaje no encontrado' });
        }
        yield learning.update(Object.assign(Object.assign({}, (description !== undefined && { description })), (order !== undefined && { order })));
        if (contentIds !== undefined && Array.isArray(contentIds)) {
            yield learning.setContents(contentIds);
        }
        return res.json(learning);
    }
    catch (error) {
        console.error('[updateExpectedLearning] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al actualizar' });
    }
});
exports.updateExpectedLearning = updateExpectedLearning;
const deleteExpectedLearning = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const learning = yield index_1.ExpectedLearning.findByPk(Number(id));
        if (!learning) {
            return res.status(404).json({ message: 'Aprendizaje no encontrado' });
        }
        yield learning.destroy();
        return res.json({ message: 'Aprendizaje eliminado' });
    }
    catch (error) {
        console.error('[deleteExpectedLearning] Error:', error);
        return res.status(500).json({ message: error.message || 'Error al eliminar' });
    }
});
exports.deleteExpectedLearning = deleteExpectedLearning;
