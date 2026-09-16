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
exports.saveEnrollmentAnswers = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const EnrollmentAnswer_1 = __importDefault(require("../models/EnrollmentAnswer.js"));
const EnrollmentQuestion_1 = __importDefault(require("../models/EnrollmentQuestion.js"));
const normalizeAnswer = (type, rawAnswer, options) => {
    if (type === 'text') {
        if (typeof rawAnswer !== 'string') {
            throw new Error('La respuesta debe ser texto.');
        }
        return rawAnswer.trim();
    }
    if (type === 'select') {
        if (!options || options.length === 0) {
            throw new Error('La pregunta no tiene opciones configuradas.');
        }
        if (typeof rawAnswer !== 'string') {
            throw new Error('Seleccione una opción válida.');
        }
        if (!options.includes(rawAnswer)) {
            throw new Error('La respuesta no coincide con ninguna opción válida.');
        }
        return rawAnswer;
    }
    if (type === 'checkbox') {
        if (!options || options.length === 0) {
            throw new Error('La pregunta no tiene opciones configuradas.');
        }
        let values;
        if (Array.isArray(rawAnswer)) {
            values = rawAnswer.filter((v) => typeof v === 'string');
        }
        else if (typeof rawAnswer === 'string') {
            values = [rawAnswer];
        }
        else {
            throw new Error('La respuesta debe ser una lista de opciones.');
        }
        const cleaned = Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)));
        if (cleaned.length === 0) {
            throw new Error('Debe seleccionar al menos una opción.');
        }
        const invalid = cleaned.filter((value) => !options.includes(value));
        if (invalid.length > 0) {
            throw new Error(`Las siguientes opciones no son válidas: ${invalid.join(', ')}`);
        }
        return cleaned;
    }
    throw new Error('Tipo de pregunta no soportado.');
};
const sanitizePayload = (answers) => {
    if (!Array.isArray(answers)) {
        return [];
    }
    const seen = new Set();
    const sanitized = [];
    for (const entry of answers) {
        if (!entry || typeof entry.questionId !== 'number' || seen.has(entry.questionId)) {
            continue;
        }
        seen.add(entry.questionId);
        sanitized.push(entry);
    }
    return sanitized;
};
const saveEnrollmentAnswers = (personId, answers, options) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const sanitizedAnswers = sanitizePayload(answers);
    const transaction = (_a = options === null || options === void 0 ? void 0 : options.transaction) !== null && _a !== void 0 ? _a : yield database_1.default.transaction();
    try {
        if (sanitizedAnswers.length === 0) {
            yield EnrollmentAnswer_1.default.destroy({
                where: { personId },
                transaction
            });
            if (!(options === null || options === void 0 ? void 0 : options.transaction))
                yield transaction.commit();
            return;
        }
        const questionIds = sanitizedAnswers.map((entry) => entry.questionId);
        const questions = yield EnrollmentQuestion_1.default.findAll({
            where: { id: questionIds },
            transaction
        });
        if (questions.length !== questionIds.length) {
            throw new Error('Una o más preguntas no existen.');
        }
        const questionMap = new Map();
        questions.forEach((question) => questionMap.set(question.id, question));
        const normalized = sanitizedAnswers.map(({ questionId, answer }) => {
            var _a;
            const question = questionMap.get(questionId);
            if (!question)
                throw new Error('Pregunta no encontrada.');
            const normalizedAnswer = normalizeAnswer(question.type, answer, (_a = question.options) !== null && _a !== void 0 ? _a : undefined);
            return { questionId, answer: normalizedAnswer };
        });
        yield EnrollmentAnswer_1.default.destroy({
            where: {
                personId,
                questionId: { [sequelize_1.Op.notIn]: questionIds }
            },
            transaction
        });
        for (const entry of normalized) {
            yield EnrollmentAnswer_1.default.upsert({
                personId,
                questionId: entry.questionId,
                answer: entry.answer
            }, { transaction });
        }
        if (!(options === null || options === void 0 ? void 0 : options.transaction))
            yield transaction.commit();
    }
    catch (error) {
        if (!(options === null || options === void 0 ? void 0 : options.transaction))
            yield transaction.rollback();
        throw error;
    }
});
exports.saveEnrollmentAnswers = saveEnrollmentAnswers;
