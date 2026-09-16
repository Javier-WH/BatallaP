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
exports.removeTeacherAssignment = exports.assignTeacherToSubject = exports.getAvailableSubjectsForPeriod = exports.getTeachers = void 0;
const index_1 = require("../models/index.js");
const sequelize_1 = require("sequelize");
const studentSortService_1 = require("../services/studentSortService.js");
const paginationService_1 = require("../services/paginationService.js");
const getTeachers = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { schoolPeriodId } = req.query;
        let targetPeriodId = schoolPeriodId ? Number(schoolPeriodId) : null;
        if (!targetPeriodId) {
            const activePeriod = yield index_1.SchoolPeriod.findOne({ where: { status: 'activo' } });
            if (activePeriod)
                targetPeriodId = activePeriod.id;
        }
        const pagination = (0, paginationService_1.parsePagination)(req.query);
        const baseInclude = [
            {
                model: index_1.Role,
                as: 'roles',
                where: { name: 'Profesor' },
                through: { attributes: [] }
            },
            {
                model: index_1.TeacherAssignment,
                as: 'teachingAssignments',
                required: false,
                include: [
                    {
                        model: index_1.PeriodGradeSubject,
                        as: 'periodGradeSubject',
                        required: targetPeriodId ? true : false,
                        include: [
                            { model: index_1.Subject, as: 'subject' },
                            {
                                model: index_1.PeriodGrade,
                                as: 'periodGrade',
                                required: targetPeriodId ? true : false,
                                where: targetPeriodId ? { schoolPeriodId: targetPeriodId } : {},
                                include: [
                                    { model: index_1.Grade, as: 'grade' },
                                    { model: index_1.SchoolPeriod, as: 'schoolPeriod' }
                                ]
                            }
                        ]
                    },
                    { model: index_1.Section, as: 'section' }
                ]
            }
        ];
        if (!pagination.isPaginated) {
            const teachers = yield index_1.Person.findAll({ include: baseInclude });
            return res.json(teachers);
        }
        // Paginated: IDs first, then hydrate.
        const idRows = yield index_1.Person.findAll({
            include: baseInclude,
            attributes: ['id'],
            order: [['id', 'ASC']],
            limit: pagination.limit,
            offset: pagination.offset,
            subQuery: false,
            raw: true,
        });
        const ids = idRows.map((r) => r.id);
        const total = yield index_1.Person.count({
            include: baseInclude,
            distinct: true,
            col: 'id',
        });
        let teachers = [];
        if (ids.length > 0) {
            teachers = yield index_1.Person.findAll({
                where: { id: { [sequelize_1.Op.in]: ids } },
                include: baseInclude,
                order: [(0, sequelize_1.literal)((0, studentSortService_1.fieldExpr)((0, studentSortService_1.quoteQualified)('Person', 'id'), ids.map(String)))],
            });
        }
        return res.json((0, paginationService_1.buildPaginatedResponse)(teachers, total, pagination));
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching teachers' });
    }
});
exports.getTeachers = getTeachers;
const getAvailableSubjectsForPeriod = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { periodId } = req.params;
        // Get all subjects defined for the period across all grades.
        // Order: periodGradeId ASC first (groups by grade), then PeriodGradeSubject.order ASC
        // (canonical order within each grade). See subjectOrderService for the rule.
        const subjects = yield index_1.PeriodGradeSubject.findAll({
            include: [
                {
                    model: index_1.PeriodGrade,
                    as: 'periodGrade',
                    where: { schoolPeriodId: periodId },
                    include: [{ model: index_1.Grade, as: 'grade' }]
                },
                { model: index_1.Subject, as: 'subject' }
            ],
            order: [
                ['periodGradeId', 'ASC'],
                ['order', 'ASC'],
            ],
        });
        // Get all assigned subjects/sections to filter out or mark as assigned
        const assignments = yield index_1.TeacherAssignment.findAll({
            include: [
                {
                    model: index_1.PeriodGradeSubject,
                    as: 'periodGradeSubject',
                    where: { '$periodGrade.schoolPeriodId$': periodId },
                    include: [{ model: index_1.PeriodGrade, as: 'periodGrade' }]
                }
            ]
        });
        res.json({ subjects, assignments });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching available subjects' });
    }
});
exports.getAvailableSubjectsForPeriod = getAvailableSubjectsForPeriod;
const assignTeacherToSubject = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { teacherId, periodGradeSubjectId, sectionId } = req.body;
        // Validar datos
        if (!teacherId || !periodGradeSubjectId || !sectionId) {
            console.error('Datos incompletos:', { teacherId, periodGradeSubjectId, sectionId });
            return res.status(400).json({ message: 'Datos incompletos. Se requiere teacherId, periodGradeSubjectId y sectionId' });
        }
        // Check if already assigned
        const existing = yield index_1.TeacherAssignment.findOne({
            where: { periodGradeSubjectId, sectionId }
        });
        console.log('Asignación existente:', existing);
        if (existing) {
            // Obtener información del profesor ya asignado
            const existingAssignment = yield index_1.TeacherAssignment.findOne({
                where: { periodGradeSubjectId, sectionId },
                include: [
                    {
                        model: index_1.Person,
                        as: 'teacher',
                        attributes: ['firstName', 'lastName']
                    },
                    {
                        model: index_1.Section,
                        as: 'section',
                        attributes: ['name']
                    }
                ]
            });
            let teacherName = 'otro profesor';
            let sectionName = '';
            if (existingAssignment) {
                if (existingAssignment.teacher) {
                    teacherName = `${existingAssignment.teacher.firstName} ${existingAssignment.teacher.lastName}`;
                }
                if (existingAssignment.section) {
                    sectionName = existingAssignment.section.name;
                }
            }
            return res.status(400).json({
                message: `Esta materia ya tiene asignado al profesor ${teacherName} en la sección ${sectionName}`
            });
        }
        // Verify the PeriodGradeSubject exists and is active (default scope)
        const pgs = yield index_1.PeriodGradeSubject.findByPk(periodGradeSubjectId);
        if (!pgs) {
            return res.status(404).json({ message: 'La materia no existe o no está activa en este grado' });
        }
        const assignment = yield index_1.TeacherAssignment.create({
            teacherId,
            periodGradeSubjectId,
            sectionId
        });
        res.json(assignment);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating assignment' });
    }
});
exports.assignTeacherToSubject = assignTeacherToSubject;
const removeTeacherAssignment = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield index_1.TeacherAssignment.destroy({ where: { id } });
        res.json({ message: 'Asignación eliminada' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error removing assignment' });
    }
});
exports.removeTeacherAssignment = removeTeacherAssignment;
