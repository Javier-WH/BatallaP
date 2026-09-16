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
exports.getObservationForBoletin = exports.saveObservation = exports.getSectionObservations = void 0;
const index_1 = require("../models/index.js");
const gradeEvaluationService_1 = require("../services/gradeEvaluationService.js");
const studentSortService_1 = require("../services/studentSortService.js");
// GET /api/observations?termId=&gradeId=&sectionId=
// Returns the students of the section with their final average, rank position,
// rank trend vs previous completed term, and any existing observation text.
// Only accessible by the guide teacher of that section.
const getSectionObservations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const personId = (_a = req.session.user) === null || _a === void 0 ? void 0 : _a.personId;
        if (!personId) {
            return res.status(403).json({ message: 'No autorizado' });
        }
        const termId = Number(req.query.termId);
        const gradeId = Number(req.query.gradeId);
        const sectionId = Number(req.query.sectionId);
        if (!termId || !gradeId || !sectionId) {
            return res.status(400).json({ message: 'Se requieren termId, gradeId y sectionId' });
        }
        // Verify the logged-in teacher is the guide for this grade+section in the active period
        const activePeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } });
        if (!activePeriod) {
            return res.status(400).json({ message: 'No hay período activo' });
        }
        const guide = yield index_1.SectionGuide.findOne({
            where: { teacherId: personId, gradeId, sectionId, schoolPeriodId: activePeriod.id },
        });
        if (!guide) {
            return res.status(403).json({ message: 'Solo el profesor guía puede acceder a las observaciones' });
        }
        // Check if the council for this term+grade+section is done (used to lock editing)
        const councilDoneRecord = yield index_1.CouncilChecklist.findOne({
            where: { schoolPeriodId: activePeriod.id, gradeId, sectionId, termId, status: 'done' },
        });
        const isLocked = !!councilDoneRecord;
        // Get all terms for this period (ordered)
        const terms = yield index_1.Term.findAll({
            where: { schoolPeriodId: activePeriod.id },
            order: [['order', 'ASC']],
        });
        // Determine completed terms (council done for this grade+section)
        const completedTermIds = [];
        for (const t of terms) {
            const done = yield index_1.CouncilChecklist.findOne({
                where: { schoolPeriodId: activePeriod.id, gradeId, sectionId, termId: t.id, status: 'done' },
            });
            if (done)
                completedTermIds.push(t.id);
        }
        // Load includeInAverage map for this grade+period
        const pg = yield index_1.PeriodGrade.findOne({
            where: { gradeId, schoolPeriodId: activePeriod.id },
            attributes: ['id'],
        });
        const pgsRecords = pg
            ? yield index_1.PeriodGradeSubject.findAll({ where: { periodGradeId: pg.id } })
            : [];
        const includeInAverageSet = new Set();
        for (const pgs of pgsRecords) {
            if (pgs.includeInAverage !== false) {
                includeInAverageSet.add(pgs.subjectId);
            }
        }
        // Get all students in this section
        const inscriptions = yield index_1.Inscription.findAll({
            where: { schoolPeriodId: activePeriod.id, gradeId, sectionId },
            include: [
                {
                    model: index_1.Person,
                    as: 'student',
                    attributes: ['id', 'firstName', 'lastName', 'document', 'documentType'],
                },
                {
                    model: index_1.InscriptionSubject,
                    as: 'inscriptionSubjects',
                    required: false,
                    include: [
                        { model: index_1.Subject, as: 'subject' },
                        { model: index_1.SubjectTermGrade, as: 'termGrades' },
                        { model: index_1.SubjectFinalGrade, as: 'finalGrade' },
                    ],
                },
            ],
            order: [
                [{ model: index_1.Person, as: 'student' }, 'lastName', 'ASC'],
                [{ model: index_1.Person, as: 'student' }, 'firstName', 'ASC'],
            ],
        });
        // Sort students canonically: document type → document number → lastName → firstName
        (0, studentSortService_1.sortInscriptions)(inscriptions);
        // Compute per-term average for each student (only eligible subjects)
        const computeTermAvg = (ins, tid) => {
            const eligibleSubjects = (ins.inscriptionSubjects || []).filter((is) => includeInAverageSet.size === 0 || includeInAverageSet.has(is.subjectId));
            const scored = eligibleSubjects
                .map((is) => {
                const tg = (is.termGrades || []).find((t) => t.termId === tid);
                if (!tg)
                    return null;
                const score = Number(tg.score);
                if (isNaN(score) || score <= 0)
                    return null;
                return Math.max(gradeEvaluationService_1.MIN_FINAL_GRADE, score);
            })
                .filter((v) => v !== null);
            if (scored.length === 0)
                return null;
            return Number((scored.reduce((a, b) => a + b, 0) / scored.length).toFixed(2));
        };
        // Build student data with averages
        const studentsData = inscriptions.map((ins) => {
            var _a, _b, _c;
            const termAvgs = new Map();
            for (const t of terms) {
                termAvgs.set(t.id, computeTermAvg(ins, t.id));
            }
            return {
                inscriptionId: ins.id,
                firstName: ((_a = ins.student) === null || _a === void 0 ? void 0 : _a.firstName) || '',
                lastName: ((_b = ins.student) === null || _b === void 0 ? void 0 : _b.lastName) || '',
                document: ((_c = ins.student) === null || _c === void 0 ? void 0 : _c.document) || '',
                termAvgs,
            };
        });
        // Compute ranking for each completed term
        const computeRankForTerm = (tid) => {
            const withAvg = studentsData
                .map((s) => ({ inscriptionId: s.inscriptionId, avg: s.termAvgs.get(tid) }))
                .filter((s) => s.avg !== null && s.avg !== undefined)
                .sort((a, b) => b.avg - a.avg);
            const rankMap = new Map();
            let currentRank = 0;
            let prevAvg = null;
            withAvg.forEach((entry, idx) => {
                if (prevAvg === null || entry.avg !== prevAvg) {
                    currentRank = idx + 1;
                    prevAvg = entry.avg;
                }
                rankMap.set(entry.inscriptionId, currentRank);
            });
            return rankMap;
        };
        const termRankMaps = new Map();
        for (const tid of completedTermIds) {
            termRankMaps.set(tid, computeRankForTerm(tid));
        }
        // Determine trend: compare current term rank vs previous completed term rank
        const currentTermIndex = completedTermIds.indexOf(termId);
        const prevTermId = currentTermIndex > 0 ? completedTermIds[currentTermIndex - 1] : null;
        const currentRankMap = termRankMaps.get(termId);
        const prevRankMap = prevTermId ? termRankMaps.get(prevTermId) : null;
        // Load existing observations for this section+term
        const observations = yield index_1.StudentObservation.findAll({
            where: { termId, schoolPeriodId: activePeriod.id },
        });
        const observationMap = new Map();
        for (const obs of observations) {
            observationMap.set(obs.inscriptionId, obs.text);
        }
        const totalStudents = studentsData.filter((s) => currentRankMap === null || currentRankMap === void 0 ? void 0 : currentRankMap.has(s.inscriptionId)).length;
        const result = studentsData.map((s) => {
            var _a, _b, _c;
            const rankPos = (_a = currentRankMap === null || currentRankMap === void 0 ? void 0 : currentRankMap.get(s.inscriptionId)) !== null && _a !== void 0 ? _a : null;
            const prevPos = (_b = prevRankMap === null || prevRankMap === void 0 ? void 0 : prevRankMap.get(s.inscriptionId)) !== null && _b !== void 0 ? _b : null;
            let trend = null;
            if (rankPos != null && prevPos != null) {
                trend = rankPos < prevPos ? 'up' : rankPos > prevPos ? 'down' : 'same';
            }
            return {
                inscriptionId: s.inscriptionId,
                firstName: s.firstName,
                lastName: s.lastName,
                document: s.document,
                finalAverage: (_c = s.termAvgs.get(termId)) !== null && _c !== void 0 ? _c : null,
                rankPosition: rankPos,
                rankTotal: rankPos != null ? totalStudents : 0,
                rankTrend: trend,
                observation: observationMap.get(s.inscriptionId) || '',
            };
        });
        // Sort by document number (orden de lista)
        result.sort((a, b) => (a.document || '').localeCompare(b.document || '', undefined, { numeric: true }));
        res.json({ students: result, isLocked });
    }
    catch (error) {
        console.error('[getSectionObservations] Error:', error);
        res.status(500).json({ message: error.message || 'Error al obtener observaciones' });
    }
});
exports.getSectionObservations = getSectionObservations;
// PUT /api/observations
// Body: { inscriptionId, termId, text }
// Upserts the observation for a student+term. Only the guide teacher can write.
const saveObservation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const personId = (_a = req.session.user) === null || _a === void 0 ? void 0 : _a.personId;
        if (!personId) {
            return res.status(403).json({ message: 'No autorizado' });
        }
        const { inscriptionId, termId, text } = req.body;
        if (!inscriptionId || !termId) {
            return res.status(400).json({ message: 'Se requieren inscriptionId y termId' });
        }
        if (text && text.length > 230) {
            return res.status(400).json({ message: 'La observación no puede exceder 230 caracteres' });
        }
        // Find the inscription to get gradeId, sectionId, schoolPeriodId
        const ins = yield index_1.Inscription.findByPk(inscriptionId, {
            include: [{ model: index_1.Grade, as: 'grade' }, { model: index_1.Section, as: 'section' }],
        });
        if (!ins) {
            return res.status(404).json({ message: 'Inscripción no encontrada' });
        }
        // Verify the teacher is the guide for this section
        const guide = yield index_1.SectionGuide.findOne({
            where: {
                teacherId: personId,
                gradeId: ins.gradeId,
                sectionId: ins.sectionId,
                schoolPeriodId: ins.schoolPeriodId,
            },
        });
        if (!guide) {
            return res.status(403).json({ message: 'Solo el profesor guía puede guardar observaciones' });
        }
        // If the council is already done for this term+grade+section, the observation is locked
        const councilDone = yield index_1.CouncilChecklist.findOne({
            where: { schoolPeriodId: ins.schoolPeriodId, gradeId: ins.gradeId, sectionId: ins.sectionId, termId, status: 'done' },
        });
        if (councilDone) {
            return res.status(400).json({ message: 'El consejo de curso de este lapso ya fue completado. Las observaciones están bloqueadas.' });
        }
        const [observation, created] = yield index_1.StudentObservation.findOrCreate({
            where: { inscriptionId, termId },
            defaults: {
                inscriptionId,
                termId,
                schoolPeriodId: ins.schoolPeriodId,
                teacherId: personId,
                text: text || '',
            },
        });
        if (!created) {
            observation.text = text || '';
            yield observation.save();
        }
        res.json(observation);
    }
    catch (error) {
        console.error('[saveObservation] Error:', error);
        res.status(500).json({ message: error.message || 'Error al guardar observación' });
    }
});
exports.saveObservation = saveObservation;
// GET /api/observations/boletin?inscriptionId=&termId=
// Returns the observation text for a specific student+term (used by boletin generation).
// No auth restriction — boletin generation runs from Control de Estudios.
const getObservationForBoletin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const inscriptionId = Number(req.query.inscriptionId);
        const termId = Number(req.query.termId);
        if (!inscriptionId || !termId) {
            return res.status(400).json({ message: 'Se requieren inscriptionId y termId' });
        }
        const obs = yield index_1.StudentObservation.findOne({
            where: { inscriptionId, termId },
        });
        res.json({ text: (obs === null || obs === void 0 ? void 0 : obs.text) || '' });
    }
    catch (error) {
        console.error('[getObservationForBoletin] Error:', error);
        res.status(500).json({ message: error.message || 'Error al obtener observación' });
    }
});
exports.getObservationForBoletin = getObservationForBoletin;
