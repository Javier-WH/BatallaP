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
exports.deactivateEnrollmentQuestion = exports.setEnrollmentQuestionStatus = exports.reorderEnrollmentQuestions = exports.updateEnrollmentQuestion = exports.createEnrollmentQuestion = exports.listEnrollmentQuestions = void 0;
const database_1 = __importDefault(require("../config/database.js"));
const EnrollmentQuestion_1 = __importDefault(require("../models/EnrollmentQuestion.js"));
const EnrollmentAnswer_1 = __importDefault(require("../models/EnrollmentAnswer.js"));
const QUESTION_TYPES = ['text', 'select', 'checkbox'];
const parseBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1';
const normalizeOptions = (type, rawOptions) => {
    if (type === 'text') {
        return null;
    }
    if (!Array.isArray(rawOptions)) {
        throw new Error('Debe proporcionar una lista de opciones.');
    }
    const cleaned = Array.from(new Set(rawOptions
        .map((option) => (typeof option === 'string' ? option.trim() : ''))
        .filter((value) => value.length > 0)));
    if (cleaned.length === 0) {
        throw new Error('Debe proporcionar al menos una opción válida.');
    }
    return cleaned;
};
const ensureQuestionType = (value) => {
    if (typeof value !== 'string') {
        throw new Error('Tipo de pregunta inválido.');
    }
    const normalized = value.toLowerCase();
    if (!QUESTION_TYPES.includes(normalized)) {
        throw new Error('Tipo de pregunta no soportado.');
    }
    return normalized;
};
const listEnrollmentQuestions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const includeInactive = parseBoolean(req.query.includeInactive);
        const personIdQuery = req.query.personId;
        let personId = null;
        if (personIdQuery !== undefined) {
            const parsedId = Number(personIdQuery);
            if (Number.isNaN(parsedId)) {
                return res.status(400).json({ message: 'personId debe ser un número' });
            }
            personId = parsedId;
        }
        const where = includeInactive ? {} : { isActive: true };
        const questions = yield EnrollmentQuestion_1.default.findAll({
            where,
            order: [
                ['order', 'ASC'],
                ['id', 'ASC']
            ]
        });
        if (personId === null) {
            return res.json(questions);
        }
        const answers = yield EnrollmentAnswer_1.default.findAll({
            where: { personId }
        });
        const answerMap = new Map(answers.map((answer) => [answer.questionId, answer.answer]));
        const response = questions.map((question) => {
            var _a;
            return (Object.assign(Object.assign({}, question.toJSON()), { answer: (_a = answerMap.get(question.id)) !== null && _a !== void 0 ? _a : null }));
        });
        res.json(response);
    }
    catch (error) {
        console.error('Error listando preguntas de inscripción:', error);
        res.status(500).json({ message: 'Error obteniendo preguntas', details: error.message || error });
    }
});
exports.listEnrollmentQuestions = listEnrollmentQuestions;
const createEnrollmentQuestion = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { prompt, description, type, options, required } = req.body;
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).json({ message: 'El texto de la pregunta es obligatorio.' });
        }
        const normalizedType = ensureQuestionType(type);
        const normalizedOptions = normalizeOptions(normalizedType, normalizedType === 'text' ? null : options);
        const currentMaxOrder = (yield EnrollmentQuestion_1.default.max('order'));
        const nextOrder = (currentMaxOrder !== null && currentMaxOrder !== void 0 ? currentMaxOrder : 0) + 1;
        const question = yield EnrollmentQuestion_1.default.create({
            prompt: prompt.trim(),
            description: typeof description === 'string' && description.trim() !== '' ? description.trim() : null,
            type: normalizedType,
            options: normalizedOptions,
            required: Boolean(required),
            order: nextOrder,
            isActive: true
        });
        res.status(201).json(question);
    }
    catch (error) {
        console.error('Error creando pregunta de inscripción:', error);
        res.status(400).json({ message: error.message || 'No se pudo crear la pregunta' });
    }
});
exports.createEnrollmentQuestion = createEnrollmentQuestion;
const updateEnrollmentQuestion = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { prompt, description, type, options, required } = req.body;
        const question = yield EnrollmentQuestion_1.default.findByPk(id);
        if (!question) {
            return res.status(404).json({ message: 'Pregunta no encontrada' });
        }
        let targetType = question.type;
        if (type !== undefined) {
            targetType = ensureQuestionType(type);
        }
        let normalizedOptions;
        if (targetType === 'text') {
            normalizedOptions = null;
        }
        else if (options !== undefined) {
            normalizedOptions = normalizeOptions(targetType, options);
        }
        else if (type !== undefined) {
            // Cambió el tipo a select/checkbox pero no se enviaron opciones
            if (!question.options || question.options.length === 0) {
                return res.status(400).json({ message: 'Debe definir opciones para este tipo de pregunta.' });
            }
        }
        question.prompt = typeof prompt === 'string' && prompt.trim() !== '' ? prompt.trim() : question.prompt;
        if (description !== undefined) {
            question.description =
                typeof description === 'string' && description.trim() !== '' ? description.trim() : null;
        }
        question.type = targetType;
        if (normalizedOptions !== undefined) {
            question.options = normalizedOptions;
        }
        if (required !== undefined) {
            question.required = Boolean(required);
        }
        yield question.save();
        res.json(question);
    }
    catch (error) {
        console.error('Error actualizando pregunta de inscripción:', error);
        res.status(400).json({ message: error.message || 'No se pudo actualizar la pregunta' });
    }
});
exports.updateEnrollmentQuestion = updateEnrollmentQuestion;
const reorderEnrollmentQuestions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { order } = req.body;
    if (!Array.isArray(order) || order.length === 0 || order.some((id) => typeof id !== 'number')) {
        return res.status(400).json({ message: 'Debe enviar un arreglo de IDs en el orden deseado.' });
    }
    const transaction = yield database_1.default.transaction();
    try {
        const questions = yield EnrollmentQuestion_1.default.findAll({
            where: { id: order },
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        if (questions.length !== order.length) {
            throw new Error('Alguna de las preguntas no existe.');
        }
        const sortPosition = new Map(order.map((questionId, index) => [questionId, index + 1]));
        for (const question of questions) {
            const nextOrder = sortPosition.get(question.id);
            if (nextOrder !== undefined) {
                question.order = nextOrder;
                yield question.save({ transaction });
            }
        }
        yield transaction.commit();
        const refreshed = yield EnrollmentQuestion_1.default.findAll({
            order: [
                ['order', 'ASC'],
                ['id', 'ASC']
            ]
        });
        res.json(refreshed);
    }
    catch (error) {
        if (transaction)
            yield transaction.rollback();
        console.error('Error reordenando preguntas de inscripción:', error);
        res.status(400).json({ message: error.message || 'No se pudo reordenar' });
    }
});
exports.reorderEnrollmentQuestions = reorderEnrollmentQuestions;
const setEnrollmentQuestionStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { isActive } = req.body;
        if (typeof isActive !== 'boolean') {
            return res.status(400).json({ message: 'Debe indicar el estado activo/inactivo.' });
        }
        const question = yield EnrollmentQuestion_1.default.findByPk(id);
        if (!question) {
            return res.status(404).json({ message: 'Pregunta no encontrada' });
        }
        question.isActive = isActive;
        yield question.save();
        res.json(question);
    }
    catch (error) {
        console.error('Error cambiando estado de pregunta de inscripción:', error);
        res.status(400).json({ message: error.message || 'No se pudo actualizar el estado' });
    }
});
exports.setEnrollmentQuestionStatus = setEnrollmentQuestionStatus;
const deactivateEnrollmentQuestion = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    req.body.isActive = false;
    return (0, exports.setEnrollmentQuestionStatus)(req, res);
});
exports.deactivateEnrollmentQuestion = deactivateEnrollmentQuestion;
