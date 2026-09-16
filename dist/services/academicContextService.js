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
exports.AcademicContextError = void 0;
exports.resolveAcademicContext = resolveAcademicContext;
exports.assertRequestedContext = assertRequestedContext;
exports.getInscriptionAcademicContext = getInscriptionAcademicContext;
const index_1 = require("../models/index.js");
class AcademicContextError extends Error {
    constructor(message) {
        super(message);
        this.statusCode = 400;
        this.name = 'AcademicContextError';
    }
}
exports.AcademicContextError = AcademicContextError;
function resolveAcademicContext(evaluationPlanId, inscriptionSubjectId, transaction) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const [plan, inscriptionSubject] = yield Promise.all([
            index_1.EvaluationPlan.findByPk(evaluationPlanId, {
                include: [
                    { model: index_1.Term, as: 'term' },
                    {
                        model: index_1.PeriodGradeSubject,
                        as: 'periodGradeSubject',
                        include: [{ model: index_1.PeriodGrade, as: 'periodGrade' }],
                    },
                ],
                transaction,
            }),
            index_1.InscriptionSubject.findByPk(inscriptionSubjectId, {
                include: [{ model: index_1.Inscription, as: 'inscription' }],
                transaction,
            }),
        ]);
        if (!plan)
            throw new AcademicContextError('Plan de evaluación no encontrado');
        if (!inscriptionSubject)
            throw new AcademicContextError('Inscripción de materia no encontrada');
        const periodGradeSubject = plan.periodGradeSubject;
        const periodGrade = periodGradeSubject === null || periodGradeSubject === void 0 ? void 0 : periodGradeSubject.periodGrade;
        const term = plan.term;
        const inscription = inscriptionSubject.inscription;
        if (!periodGradeSubject || !periodGrade || !term || !inscription) {
            throw new AcademicContextError('No se pudo resolver el contexto académico completo');
        }
        const context = {
            schoolPeriodId: Number(periodGrade.schoolPeriodId),
            gradeId: Number(periodGrade.gradeId),
            sectionId: plan.sectionId == null ? null : Number(plan.sectionId),
            subjectId: Number(periodGradeSubject.subjectId),
            termId: Number(plan.termId),
            date: (_a = plan.date) !== null && _a !== void 0 ? _a : null,
            evaluationPlanId: Number(plan.id),
            inscriptionId: Number(inscription.id),
            inscriptionSubjectId: Number(inscriptionSubject.id),
        };
        if (Number(term.schoolPeriodId) !== context.schoolPeriodId) {
            throw new AcademicContextError('El lapso no pertenece al período del plan de evaluación');
        }
        if (Number(inscription.schoolPeriodId) !== context.schoolPeriodId) {
            throw new AcademicContextError('La inscripción no pertenece al período del plan de evaluación');
        }
        if (Number(inscription.gradeId) !== context.gradeId) {
            throw new AcademicContextError('La inscripción no pertenece al grado del plan de evaluación');
        }
        if (Number(inscriptionSubject.subjectId) !== context.subjectId) {
            throw new AcademicContextError('La materia no coincide con el plan de evaluación');
        }
        if (context.sectionId !== null && Number(inscription.sectionId) !== context.sectionId) {
            throw new AcademicContextError('La sección no coincide con el plan de evaluación');
        }
        return context;
    });
}
function assertRequestedContext(context, requested) {
    for (const field of ['schoolPeriodId', 'gradeId', 'termId', 'subjectId']) {
        if (requested[field] !== undefined && Number(requested[field]) !== context[field]) {
            throw new AcademicContextError(`El ${field} no coincide con el contexto académico`);
        }
    }
    if (requested.sectionId !== undefined && (requested.sectionId == null ? null : Number(requested.sectionId)) !== context.sectionId) {
        throw new AcademicContextError('La sección no coincide con el contexto académico');
    }
}
function getInscriptionAcademicContext(inscriptionSubjectId, transaction) {
    return __awaiter(this, void 0, void 0, function* () {
        const inscriptionSubject = yield index_1.InscriptionSubject.findByPk(inscriptionSubjectId, {
            include: [{ model: index_1.Inscription, as: 'inscription' }],
            transaction,
        });
        const inscription = inscriptionSubject === null || inscriptionSubject === void 0 ? void 0 : inscriptionSubject.inscription;
        if (!inscriptionSubject || !inscription) {
            throw new AcademicContextError('No se pudo resolver el contexto de la inscripción');
        }
        return {
            schoolPeriodId: Number(inscription.schoolPeriodId),
            gradeId: Number(inscription.gradeId),
            sectionId: inscription.sectionId == null ? null : Number(inscription.sectionId),
            subjectId: Number(inscriptionSubject.subjectId),
            inscriptionId: Number(inscription.id),
        };
    });
}
