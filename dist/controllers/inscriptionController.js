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
exports.reactivateInscription = exports.withdrawInscription = exports.unmatriculateInscription = exports.checkGroupSubjectChangeImpact = exports.setGroupSubjectForTerm = exports.getGroupSubjectChoices = exports.bulkToggleMatriculationVisibility = exports.toggleMatriculationVisibility = exports.updateMatriculation = exports.registerAndEnroll = exports.removeSubjectFromInscription = exports.addSubjectToInscription = exports.deleteInscription = exports.updateInscription = exports.createInscription = exports.getInscriptionById = exports.getMatriculationsStats = exports.getInscriptionsStats = exports.getInscriptions = exports.enrollMatriculatedStudent = exports.getMatriculationById = exports.getMatriculations = exports.quickRegister = void 0;
const sequelize_1 = require("sequelize");
const models_1 = require("../models");
const groupSubjectChoiceService_1 = require("../services/groupSubjectChoiceService.js");
const subjectOrderService_1 = require("../services/subjectOrderService.js");
const database_1 = __importDefault(require("../config/database"));
const enrollmentAnswerService_1 = require("../services/enrollmentAnswerService.js");
const studentGuardianService_1 = require("../services/studentGuardianService.js");
const studentEnrollmentService_1 = require("../services/studentEnrollmentService.js");
const enrollmentReportService_1 = require("../services/enrollmentReportService.js");
const studentSortService_1 = require("../services/studentSortService.js");
const paginationService_1 = require("../services/paginationService.js");
const ESCOLARIDAD_VALUES = ['regular', 'repitiente', 'materia_pendiente'];
const deriveRepresentativeType = (guardians = []) => {
    var _a;
    const assignment = guardians.find(g => g.isRepresentative === true || g.isRepresentative === 1);
    const relationship = String((_a = assignment === null || assignment === void 0 ? void 0 : assignment.relationship) !== null && _a !== void 0 ? _a : '').trim().toLowerCase();
    if (relationship === 'mother' || relationship === 'madre')
        return 'mother';
    if (relationship === 'father' || relationship === 'padre')
        return 'father';
    if (relationship === 'sibling' || relationship === 'hermano')
        return 'sibling';
    if (relationship === 'grandparent' || relationship === 'abuelo')
        return 'grandparent';
    if (relationship === 'uncle_aunt' || relationship === 'tio')
        return 'uncle_aunt';
    return 'other';
};
const normalizeEscolaridad = (value) => {
    if (typeof value !== 'string')
        return 'regular';
    const normalized = value.trim().toLowerCase();
    if (ESCOLARIDAD_VALUES.includes(normalized)) {
        return normalized;
    }
    throw new Error('Valor de escolaridad inválido. Debe ser regular, repitiente o materia_pendiente.');
};
const quickRegister = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const t = yield database_1.default.transaction();
    try {
        const { schoolPeriodId, gradeId, sectionId, firstName, lastName, documentType, document, gender, birthdate, escolaridad } = req.body;
        if (!gradeId) {
            yield t.rollback();
            return res.status(400).json({ error: 'El grado es obligatorio' });
        }
        const targetPeriodId = schoolPeriodId
            ? schoolPeriodId
            : (_a = (yield models_1.SchoolPeriod.findOne({
                where: { status: 'activo' },
                attributes: ['id'],
                transaction: t
            }))) === null || _a === void 0 ? void 0 : _a.id;
        if (!targetPeriodId) {
            yield t.rollback();
            return res.status(400).json({ error: 'No se encontró un periodo escolar activo' });
        }
        if (!firstName || !lastName || !documentType || !document || !gender || !birthdate) {
            yield t.rollback();
            return res.status(400).json({ error: 'Datos básicos del estudiante incompletos' });
        }
        const person = yield models_1.Person.create({
            firstName,
            lastName,
            documentType,
            document,
            gender,
            birthdate,
            userId: null
        }, { transaction: t });
        let studentRole = yield models_1.Role.findOne({ where: { name: 'Alumno' }, transaction: t });
        if (!studentRole) {
            studentRole = yield models_1.Role.create({ name: 'Alumno' }, { transaction: t });
        }
        yield models_1.PersonRole.create({ personId: person.id, roleId: studentRole.id }, { transaction: t });
        const matriculation = yield models_1.Matriculation.create({
            personId: person.id,
            schoolPeriodId: targetPeriodId,
            gradeId,
            sectionId: sectionId || null,
            status: 'pending',
            escolaridad: normalizeEscolaridad(escolaridad)
        }, { transaction: t });
        yield t.commit();
        res.status(201).json({
            message: 'Estudiante matriculado exitosamente',
            person,
            matriculation
        });
    }
    catch (error) {
        if (t)
            yield t.rollback();
        console.error('Error en quickRegister:', error);
        res.status(500).json({ error: 'Error al matricular estudiante', details: error.message || error });
    }
});
exports.quickRegister = quickRegister;
const guardianRequiredFields = [
    'firstName',
    'lastName',
    'documentType',
    'document',
    'residenceState',
    'residenceMunicipality',
    'residenceParish',
    'address',
    'phone',
    'email'
];
const isEmptyValue = (value) => {
    if (value === null || value === undefined)
        return true;
    if (typeof value === 'string')
        return value.trim() === '';
    return false;
};
const hasGuardianData = (data) => {
    if (!data)
        return false;
    return Object.values(data).some((value) => !isEmptyValue(value));
};
const validateGuardianPayload = (label, data, required) => {
    const hasData = hasGuardianData(data);
    if (!hasData) {
        if (required) {
            throw new Error(`Los datos de ${label} son obligatorios.`);
        }
        return null;
    }
    if (!required) {
        const hasIdentity = !isEmptyValue(data === null || data === void 0 ? void 0 : data.firstName) || !isEmptyValue(data === null || data === void 0 ? void 0 : data.lastName) || !isEmptyValue(data === null || data === void 0 ? void 0 : data.document);
        if (!hasIdentity) {
            return null;
        }
    }
    const missingFields = guardianRequiredFields.filter((field) => isEmptyValue(data === null || data === void 0 ? void 0 : data[field]));
    if (missingFields.length > 0) {
        throw new Error(`Faltan campos obligatorios para ${label}: ${missingFields.join(', ')}`);
    }
    return data;
};
const mapToGuardianProfilePayload = (data) => ({
    id: data.id,
    firstName: data.firstName,
    lastName: data.lastName,
    documentType: data.documentType,
    document: data.document,
    phone: data.phone,
    phone2: data.phone2,
    whatsapp: data.whatsapp,
    email: data.email,
    residenceState: data.residenceState,
    residenceMunicipality: data.residenceMunicipality,
    residenceParish: data.residenceParish,
    address: data.address,
    occupation: data.occupation,
    birthdate: data.birthdate ? new Date(data.birthdate) : null
});
const getMatriculations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { status, schoolPeriodId, gradeId, sectionId, q, gender, escolaridad, hidden } = req.query;
        const where = {};
        if (status)
            where.status = status; // Solo filtrar si se especifica
        // NO filtrar por schoolPeriodId por defecto - mostrar todos los períodos
        if (schoolPeriodId)
            where.schoolPeriodId = schoolPeriodId;
        if (gradeId)
            where.gradeId = gradeId;
        if (sectionId)
            where.sectionId = sectionId;
        if (escolaridad)
            where.escolaridad = escolaridad;
        // Exclude withdrawn matriculations by default (use status=withdrawn to see them)
        if (!status) {
            where.status = { [sequelize_1.Op.ne]: 'withdrawn' };
        }
        // Hide hidden students from non-admin roles
        const userRoles = ((_a = req.session.user) === null || _a === void 0 ? void 0 : _a.roles) || [];
        const isPrivileged = userRoles.includes('Master') || userRoles.includes('Administrador');
        if (!isPrivileged) {
            where.hiddenFromControlEstudios = false;
        }
        else if (hidden !== undefined) {
            where.hiddenFromControlEstudios = hidden === 'true' || hidden === '1';
        }
        const studentWhere = {};
        let hasStudentFilter = false;
        if (q) {
            const like = `%${q}%`;
            studentWhere[sequelize_1.Op.or] = [
                { firstName: { [sequelize_1.Op.like]: like } },
                { lastName: { [sequelize_1.Op.like]: like } },
                { document: { [sequelize_1.Op.like]: like } }
            ];
            hasStudentFilter = true;
        }
        if (gender) {
            studentWhere.gender = gender;
            hasStudentFilter = true;
        }
        // Pagination is opt-in: when page/pageSize are absent, behavior is identical
        // to the legacy flow (return a flat array, no limit/offset).
        const pagination = (0, paginationService_1.parsePagination)(req.query);
        // "IDs first, then hydrate" pattern (see getInscriptions for rationale).
        // Note: the canonical order for Matriculation uses the same comparator as
        // Inscription (documentType → document → lastName → firstName → grade → section),
        // but the primary key is Matriculation.id, so we build the order inline.
        const orderInclude = [
            {
                model: models_1.Person,
                as: 'student',
                where: hasStudentFilter ? studentWhere : undefined,
                required: hasStudentFilter,
                attributes: ['id', 'documentType', 'document', 'firstName', 'lastName'],
            },
            { model: models_1.Grade, as: 'grade', attributes: ['id', 'order', 'name'] },
            { model: models_1.Section, as: 'section', attributes: ['id', 'name'] },
        ];
        const canonicalOrder = [
            [(0, sequelize_1.literal)((0, studentSortService_1.fieldExpr)((0, studentSortService_1.quoteQualified)('student', 'documentType'), ['Venezolano', 'Cedula Escolar', 'Pasaporte', 'Extranjero'])), 'ASC'],
            [(0, sequelize_1.literal)((0, studentSortService_1.numericDocumentSQL)((0, studentSortService_1.quoteQualified)('student', 'document'))), 'ASC'],
            [(0, sequelize_1.literal)((0, studentSortService_1.lower)((0, studentSortService_1.quoteQualified)('student', 'lastName'))), 'ASC'],
            [(0, sequelize_1.literal)((0, studentSortService_1.lower)((0, studentSortService_1.quoteQualified)('student', 'firstName'))), 'ASC'],
            [(0, sequelize_1.literal)(`COALESCE(${(0, studentSortService_1.quoteQualified)('grade', 'order')}, 9999)`), 'ASC'],
            [(0, sequelize_1.literal)((0, studentSortService_1.lower)((0, studentSortService_1.quoteQualified)('grade', 'name'))), 'ASC'],
            [(0, sequelize_1.literal)((0, studentSortService_1.lower)((0, studentSortService_1.quoteQualified)('section', 'name'))), 'ASC'],
            ['id', 'ASC'],
        ];
        const idRows = yield models_1.Matriculation.findAll({
            where,
            include: orderInclude,
            attributes: ['id'],
            order: canonicalOrder,
            limit: pagination.isPaginated ? pagination.limit : undefined,
            offset: pagination.isPaginated ? pagination.offset : undefined,
            subQuery: false,
            raw: true,
        });
        const ids = idRows.map((r) => r.id);
        let total = ids.length;
        if (pagination.isPaginated) {
            total = (yield models_1.Matriculation.count({
                where,
                include: orderInclude,
                distinct: true,
                col: 'id',
            }));
        }
        let matriculations;
        if (ids.length > 0) {
            matriculations = yield models_1.Matriculation.findAll({
                where: { id: { [sequelize_1.Op.in]: ids } },
                include: [
                    {
                        model: models_1.Person,
                        as: 'student',
                        include: [
                            { model: models_1.Contact, as: 'contact' },
                            { model: models_1.PersonResidence, as: 'residence' },
                            {
                                model: models_1.StudentGuardian,
                                as: 'guardians',
                                include: [{ model: models_1.GuardianProfile, as: 'profile' }]
                            },
                            { model: models_1.StudentPreviousSchool, as: 'previousSchools' },
                            {
                                model: models_1.EnrollmentAnswer,
                                as: 'enrollmentAnswers',
                                include: [{ model: models_1.EnrollmentQuestion, as: 'question' }]
                            }
                        ]
                    },
                    { model: models_1.SchoolPeriod, as: 'period' },
                    { model: models_1.Grade, as: 'grade' },
                    { model: models_1.Section, as: 'section' },
                    { model: models_1.EnrollmentDocument, as: 'documents' }
                ],
                order: [(0, sequelize_1.literal)((0, studentSortService_1.fieldExpr)((0, studentSortService_1.quoteQualified)('Matriculation', 'id'), ids.map(String)))],
            });
        }
        else {
            matriculations = [];
        }
        const result = matriculations.map(matriculation => {
            const json = matriculation.toJSON();
            if (json.student) {
                json.student.representativeType = deriveRepresentativeType(json.student.guardians);
            }
            return json;
        });
        // When paginated, order is already canonical from step 1.
        // When unpaginated, preserve the exact legacy behavior (JS sort) so
        // existing consumers see no difference.
        if (!pagination.isPaginated) {
            (0, studentSortService_1.sortInscriptions)(result);
        }
        res.json((0, paginationService_1.buildPaginatedResponse)(result, total, pagination));
    }
    catch (error) {
        console.error('Error fetching matriculations:', error);
        res.status(500).json({ error: 'Error obteniendo matriculados' });
    }
});
exports.getMatriculations = getMatriculations;
const getMatriculationById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const matriculation = yield models_1.Matriculation.findByPk(id, {
            include: [
                {
                    model: models_1.Person,
                    as: 'student',
                    include: [
                        { model: models_1.Contact, as: 'contact' },
                        { model: models_1.PersonResidence, as: 'residence' },
                        { model: models_1.StudentGuardian, as: 'guardians' },
                        { model: models_1.StudentPreviousSchool, as: 'previousSchools' }
                    ]
                },
                { model: models_1.SchoolPeriod, as: 'period' },
                { model: models_1.Grade, as: 'grade' },
                { model: models_1.Section, as: 'section' },
                { model: models_1.Inscription, as: 'inscription' }
            ]
        });
        if (!matriculation) {
            return res.status(404).json({ error: 'Matriculación no encontrada' });
        }
        res.json(matriculation);
    }
    catch (error) {
        console.error('Error fetching matriculation:', error);
        res.status(500).json({ error: 'Error obteniendo la matriculación' });
    }
});
exports.getMatriculationById = getMatriculationById;
const enrollMatriculatedStudent = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const t = yield database_1.default.transaction();
    try {
        const { id } = req.params;
        const { firstName, lastName, documentType, document, gender, birthdate, birthState, birthMunicipality, birthParish, residenceState, residenceMunicipality, residenceParish, address, phone1, phone2, email, whatsapp, previousSchoolIds, gradeId, sectionId, schoolPeriodId, mother, father, representative, representativeType, enrollmentAnswers, escolaridad, } = req.body;
        const matriculation = (yield models_1.Matriculation.findByPk(id, {
            include: [{ model: models_1.Person, as: 'student' }],
            transaction: t,
            lock: t.LOCK.UPDATE
        }));
        if (!matriculation) {
            yield t.rollback();
            return res.status(404).json({ error: 'Matriculación no encontrada' });
        }
        if (matriculation.status === 'completed') {
            yield t.rollback();
            return res.status(400).json({ error: 'El estudiante ya fue inscrito' });
        }
        const person = matriculation.student;
        if (!person) {
            yield t.rollback();
            return res.status(400).json({ error: 'No se encontró el estudiante asociado' });
        }
        if (!firstName || !lastName || !documentType || !gender || !birthdate) {
            yield t.rollback();
            return res.status(400).json({ error: 'Datos básicos del estudiante incompletos' });
        }
        person.firstName = firstName;
        person.lastName = lastName;
        person.documentType = documentType;
        person.document = document || null;
        person.gender = gender;
        person.birthdate = birthdate;
        yield person.save({ transaction: t });
        // Inherit phone from the representative if not explicitly provided.
        const repSource = representative || (representativeType === 'mother' ? mother : representativeType === 'father' ? father : null);
        const inheritedPhone = (repSource === null || repSource === void 0 ? void 0 : repSource.phone) || '';
        const inheritedWhatsapp = (repSource === null || repSource === void 0 ? void 0 : repSource.whatsapp) || (repSource === null || repSource === void 0 ? void 0 : repSource.phone) || '';
        const inheritedPhone2 = (repSource === null || repSource === void 0 ? void 0 : repSource.phone2) || '';
        // Contact
        const finalPhone1 = phone1 || inheritedPhone;
        const finalWhatsapp = whatsapp || inheritedWhatsapp;
        const finalPhone2 = phone2 || inheritedPhone2;
        if (finalPhone1 || finalPhone2 || email || address || finalWhatsapp) {
            const contactPayload = { phone1: finalPhone1, phone2: finalPhone2, email, address, whatsapp: finalWhatsapp, personId: person.id };
            const existingContact = yield models_1.Contact.findOne({ where: { personId: person.id }, transaction: t, lock: t.LOCK.UPDATE });
            if (existingContact) {
                yield existingContact.update(contactPayload, { transaction: t });
            }
            else {
                yield models_1.Contact.create(contactPayload, { transaction: t });
            }
        }
        // Previous Schools
        if (Array.isArray(previousSchoolIds)) {
            // 1. Clear old
            yield models_1.StudentPreviousSchool.destroy({ where: { personId: person.id }, transaction: t });
            // 2. Map and add new
            const schoolRecords = [];
            for (const item of previousSchoolIds) {
                // Find plantel to get details
                const plantel = yield models_1.Plantel.findOne({
                    where: {
                        [sequelize_1.Op.or]: [{ code: item }, { name: item }]
                    },
                    transaction: t
                });
                schoolRecords.push({
                    personId: person.id,
                    plantelCode: (plantel === null || plantel === void 0 ? void 0 : plantel.code) || (typeof item === 'string' ? item : null),
                    plantelName: (plantel === null || plantel === void 0 ? void 0 : plantel.name) || (typeof item === 'string' ? item : 'Desconocido'),
                    state: (plantel === null || plantel === void 0 ? void 0 : plantel.state) || null,
                    dependency: (plantel === null || plantel === void 0 ? void 0 : plantel.dependency) || null
                });
            }
            if (schoolRecords.length > 0) {
                yield models_1.StudentPreviousSchool.bulkCreate(schoolRecords, { transaction: t });
            }
        }
        // Residence
        if (!birthState || !birthMunicipality || !birthParish || !residenceState || !residenceMunicipality || !residenceParish) {
            yield t.rollback();
            return res.status(400).json({ error: 'Datos de nacimiento y residencia son obligatorios.' });
        }
        const residencePayload = {
            birthState,
            birthMunicipality,
            birthParish,
            residenceState,
            residenceMunicipality,
            residenceParish,
            personId: person.id
        };
        const existingResidence = yield models_1.PersonResidence.findOne({ where: { personId: person.id }, transaction: t, lock: t.LOCK.UPDATE });
        if (existingResidence) {
            yield existingResidence.update(residencePayload, { transaction: t });
        }
        else {
            yield models_1.PersonResidence.create(residencePayload, { transaction: t });
        }
        // Guardians
        const validRepresentativeTypes = ['mother', 'father', 'sibling', 'grandparent', 'uncle_aunt', 'other'];
        const representativeSelection = typeof representativeType === 'string' && validRepresentativeTypes.includes(representativeType)
            ? representativeType
            : 'mother';
        const motherIsRepresentative = representativeSelection === 'mother';
        const fatherIsRepresentative = representativeSelection === 'father';
        const representativeDataRequired = !motherIsRepresentative && !fatherIsRepresentative;
        const motherDataRequired = motherIsRepresentative || (documentType === 'Cedula Escolar' && (!document || !document.trim()));
        const fatherDataRequired = fatherIsRepresentative;
        const motherData = validateGuardianPayload('la madre', mother, motherDataRequired);
        const fatherData = validateGuardianPayload('el padre', father, fatherDataRequired);
        const representativeData = validateGuardianPayload('el representante', representative, representativeDataRequired);
        if (!motherIsRepresentative && !fatherIsRepresentative && !representativeData) {
            throw new Error('Debe registrar un representante si la madre o el padre no lo son.');
        }
        yield models_1.StudentGuardian.destroy({ where: { studentId: person.id }, transaction: t });
        const guardiansToCreate = [];
        const assignments = [];
        if (motherData) {
            assignments.push({
                payload: mapToGuardianProfilePayload(motherData),
                relationship: 'mother',
                isRepresentative: motherIsRepresentative
            });
        }
        if (fatherData) {
            assignments.push({
                payload: mapToGuardianProfilePayload(fatherData),
                relationship: 'father',
                isRepresentative: fatherIsRepresentative
            });
        }
        if (representativeData) {
            const repRelationship = (representativeSelection === 'sibling' || representativeSelection === 'grandparent' || representativeSelection === 'uncle_aunt')
                ? representativeSelection
                : 'representative';
            assignments.push({
                payload: mapToGuardianProfilePayload(representativeData),
                relationship: repRelationship,
                isRepresentative: true
            });
        }
        if (assignments.length > 0) {
            yield (0, studentGuardianService_1.assignGuardians)(person.id, assignments, t);
        }
        if (Array.isArray(enrollmentAnswers)) {
            yield (0, enrollmentAnswerService_1.saveEnrollmentAnswers)(person.id, enrollmentAnswers, { transaction: t });
        }
        const targetPeriodId = schoolPeriodId || matriculation.schoolPeriodId;
        const targetGradeId = gradeId || matriculation.gradeId;
        const targetSectionId = (_a = sectionId !== null && sectionId !== void 0 ? sectionId : matriculation.sectionId) !== null && _a !== void 0 ? _a : null;
        const rawGroupSubjectIds = Array.isArray(req.body.subjectIds) ? req.body.subjectIds : [];
        const selectedGroupSubjectIds = Array.from(new Set(rawGroupSubjectIds
            .map((subjectId) => Number(subjectId))
            .filter((subjectId) => Number.isFinite(subjectId))));
        const escolaridadValue = normalizeEscolaridad(escolaridad !== null && escolaridad !== void 0 ? escolaridad : matriculation.escolaridad);
        const existingInscription = yield models_1.Inscription.findOne({
            where: { schoolPeriodId: targetPeriodId, personId: person.id },
            transaction: t,
            lock: t.LOCK.UPDATE
        });
        if (existingInscription) {
            // The student already has an inscription in this period (e.g. was previously
            // matriculated then "un-matriculated"). Reuse it instead of blocking — just
            // update the section and clear any withdrawn state.
            existingInscription.sectionId = targetSectionId;
            existingInscription.escolaridad = escolaridadValue;
            existingInscription.withdrawnAt = null;
            yield existingInscription.save({ transaction: t });
            matriculation.escolaridad = escolaridadValue;
            matriculation.status = 'completed';
            matriculation.sectionId = targetSectionId;
            matriculation.inscriptionId = existingInscription.id;
            yield matriculation.save({ transaction: t });
            // Update InscriptionSubject sectionId references
            yield models_1.InscriptionSubject.update({ sectionId: targetSectionId }, { where: { inscriptionId: existingInscription.id }, transaction: t });
            yield t.commit();
            const result = yield models_1.Matriculation.findByPk(matriculation.id, {
                include: [{ model: models_1.Person, as: 'student' }, { model: models_1.Grade, as: 'grade' }, { model: models_1.Section, as: 'section' }]
            });
            return res.json(result);
        }
        matriculation.escolaridad = escolaridadValue;
        yield matriculation.save({ transaction: t });
        const inscription = yield models_1.Inscription.create({
            schoolPeriodId: targetPeriodId,
            gradeId: targetGradeId,
            sectionId: targetSectionId,
            personId: person.id,
            escolaridad: escolaridadValue
        }, { transaction: t });
        const periodGrade = yield models_1.PeriodGrade.findOne({
            where: { schoolPeriodId: targetPeriodId, gradeId: targetGradeId },
            include: [{ model: models_1.Subject, as: 'subjects', through: { where: { active: true } } }],
            transaction: t
        });
        if ((_b = periodGrade === null || periodGrade === void 0 ? void 0 : periodGrade.subjects) === null || _b === void 0 ? void 0 : _b.length) {
            console.log(`[Enrollment] Processing ${periodGrade.subjects.length} subjects for grade ${targetGradeId}`);
            // 1. Core subjects (no group)
            const coreSubjects = periodGrade.subjects
                .filter((s) => !s.subjectGroupId)
                .map((s) => ({
                inscriptionId: inscription.id,
                subjectId: s.id,
                schoolPeriodId: targetPeriodId,
                gradeId: targetGradeId,
                sectionId: targetSectionId
            }));
            // 2. Selected group subjects
            const groupSubjects = periodGrade.subjects
                .filter((s) => s.subjectGroupId && selectedGroupSubjectIds.includes(s.id))
                .map((s) => ({
                inscriptionId: inscription.id,
                subjectId: s.id,
                schoolPeriodId: targetPeriodId,
                gradeId: targetGradeId,
                sectionId: targetSectionId
            }));
            const subjectsToAdd = [...coreSubjects, ...groupSubjects];
            console.log(`[Enrollment] Enrolling in ${subjectsToAdd.length} subjects (${coreSubjects.length} core, ${groupSubjects.length} group)`);
            if (subjectsToAdd.length > 0) {
                yield models_1.InscriptionSubject.bulkCreate(subjectsToAdd, { transaction: t });
            }
        }
        matriculation.gradeId = targetGradeId;
        matriculation.sectionId = targetSectionId;
        matriculation.schoolPeriodId = targetPeriodId;
        matriculation.status = 'completed';
        matriculation.inscriptionId = inscription.id;
        yield matriculation.save({ transaction: t });
        let reportUuid;
        try {
            const report = yield (0, enrollmentReportService_1.generateEnrollmentReport)(matriculation.id, t);
            reportUuid = report.uuid;
        }
        catch (reportError) {
            console.warn('[enrollMatriculated] No se pudo generar reporte:', reportError);
        }
        yield t.commit();
        const result = yield models_1.Matriculation.findByPk(id, {
            include: [
                { model: models_1.Person, as: 'student' },
                { model: models_1.Inscription, as: 'inscription' }
            ]
        });
        res.status(201).json({
            message: 'Estudiante inscrito exitosamente',
            matriculation: result,
            reportUuid
        });
    }
    catch (error) {
        if (t)
            yield t.rollback();
        const errMsg = (error === null || error === void 0 ? void 0 : error.message) || (typeof error === 'string' ? error : JSON.stringify(error));
        const errStack = error === null || error === void 0 ? void 0 : error.stack;
        console.error('Error al inscribir matriculado:', errMsg, '\n', errStack);
        res.status(500).json({ error: 'Error al inscribir estudiante matriculado', details: errMsg });
    }
});
exports.enrollMatriculatedStudent = enrollMatriculatedStudent;
const getInscriptions = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { schoolPeriodId, gradeId, sectionId, q, gender, escolaridad, hidden, includeAuxiliary, includeWithdrawn } = req.query;
        const where = {};
        // NO filtrar por schoolPeriodId por defecto - mostrar todos los períodos
        if (schoolPeriodId)
            where.schoolPeriodId = schoolPeriodId;
        if (gradeId)
            where.gradeId = gradeId;
        if (sectionId)
            where.sectionId = sectionId;
        if (escolaridad)
            where.escolaridad = escolaridad;
        // Hide hidden students from non-admin roles
        const userRoles = ((_a = req.session.user) === null || _a === void 0 ? void 0 : _a.roles) || [];
        const isPrivileged = userRoles.includes('Master') || userRoles.includes('Administrador');
        // Move the hidden-student filter into the SQL WHERE (was a post-query JS filter).
        // For non-privileged users, always exclude hidden. For privileged users, allow
        // explicit filtering via the `hidden` query param (used by MatriculationEnrollment's
        // "inscrito/no_inscrito" filter).
        const andConditions = [];
        const hiddenCol = (0, studentSortService_1.quoteQualified)('matriculation', 'hiddenFromControlEstudios');
        if (!isPrivileged) {
            andConditions.push((0, sequelize_1.literal)(`${hiddenCol} = false`));
        }
        else if (hidden !== undefined) {
            const hiddenBool = hidden === 'true' || hidden === '1';
            andConditions.push((0, sequelize_1.literal)(`${hiddenCol} = ${hiddenBool ? 'true' : 'false'}`));
        }
        // Exclude auxiliary "Materia Pendiente" inscriptions by default.
        // These are separate inscriptions created during period closure for students
        // who need to retake subjects from a previous grade. They should NOT appear
        // in the normal enrollment list — the student's real inscription is in their
        // current grade with a regular section.
        // Use includeAuxiliary=true to include them (e.g. for the pending subjects module).
        if (includeAuxiliary !== 'true' && sectionId === undefined) {
            const mpSection = yield models_1.Section.findOne({ where: { name: 'MATERIA PENDIENTE' } });
            if (mpSection) {
                // Exclude Materia Pendiente section, but keep null sectionIds (e.g. withdrawn students)
                andConditions.push({
                    [sequelize_1.Op.or]: [
                        { sectionId: { [sequelize_1.Op.ne]: mpSection.id } },
                        { sectionId: null }
                    ]
                });
            }
        }
        // Filter by matriculation status:
        // - Default: only 'completed' (active students)
        // - includeWithdrawn=true: only 'withdrawn' (retired students)
        // - 'pending' students never appear here (they're in "No Matriculados")
        const matStatusCol = (0, studentSortService_1.quoteQualified)('matriculation', 'status');
        if (req.query.includeWithdrawn === 'true') {
            andConditions.push((0, sequelize_1.literal)(`${matStatusCol} = 'withdrawn'`));
        }
        else {
            andConditions.push((0, sequelize_1.literal)(`${matStatusCol} = 'completed'`));
        }
        if (andConditions.length > 0) {
            where[sequelize_1.Op.and] = andConditions;
        }
        const personWhere = {};
        let hasPersonFilter = false;
        if (gender) {
            personWhere.gender = gender;
            hasPersonFilter = true;
        }
        // Search by name, last name or document
        if (q) {
            personWhere[sequelize_1.Op.or] = [
                { firstName: { [sequelize_1.Op.like]: `%${q}%` } },
                { lastName: { [sequelize_1.Op.like]: `%${q}%` } },
                { document: { [sequelize_1.Op.like]: `%${q}%` } }
            ];
            hasPersonFilter = true;
        }
        // Pagination is opt-in: when page/pageSize are absent, behavior is identical
        // to the legacy flow (return a flat array, no limit/offset).
        const pagination = (0, paginationService_1.parsePagination)(req.query);
        // The "IDs first, then hydrate" pattern avoids the Sequelize pitfall where
        // `limit` + hasMany includes produce duplicated/truncated rows.
        //
        // Step 1: find the ordered IDs (and total count) with a lightweight query
        //         that only includes the filters needed for WHERE and ORDER.
        // Step 2: hydrate those IDs with the full include tree (no limit).
        const orderInclude = [
            {
                model: models_1.Person,
                as: 'student',
                where: hasPersonFilter ? personWhere : undefined,
                required: hasPersonFilter,
                attributes: ['id', 'documentType', 'document', 'firstName', 'lastName'],
            },
            { model: models_1.Grade, as: 'grade', attributes: ['id', 'order', 'name'] },
            { model: models_1.Section, as: 'section', attributes: ['id', 'name'] },
            { model: models_1.Matriculation, as: 'matriculation', attributes: ['id', 'hiddenFromControlEstudios'] },
        ];
        const idRows = yield models_1.Inscription.findAll({
            where,
            include: orderInclude,
            attributes: ['id'],
            order: (0, studentSortService_1.canonicalInscriptionOrder)(),
            limit: pagination.isPaginated ? pagination.limit : undefined,
            offset: pagination.isPaginated ? pagination.offset : undefined,
            subQuery: false,
            raw: true,
        });
        const ids = idRows.map((r) => r.id);
        // Total count for the paginated envelope. Computed with a separate count
        // query that mirrors the WHERE/includes used above (without order/limit).
        let total = ids.length;
        if (pagination.isPaginated) {
            total = (yield models_1.Inscription.count({
                where,
                include: orderInclude,
                distinct: true,
                col: 'id',
            }));
        }
        // Step 2: hydrate the IDs with the full include tree.
        // When unpaginated, ids is the full set so behavior is identical to before.
        let inscriptions;
        if (ids.length > 0) {
            inscriptions = yield models_1.Inscription.findAll({
                where: { id: { [sequelize_1.Op.in]: ids } },
                include: [
                    {
                        model: models_1.Person,
                        as: 'student',
                        include: [
                            { model: models_1.Contact, as: 'contact' },
                            { model: models_1.PersonResidence, as: 'residence' },
                            {
                                model: models_1.StudentGuardian,
                                as: 'guardians',
                                include: [{ model: models_1.GuardianProfile, as: 'profile' }]
                            },
                            {
                                model: models_1.EnrollmentAnswer,
                                as: 'enrollmentAnswers',
                                include: [{ model: models_1.EnrollmentQuestion, as: 'question' }]
                            }
                        ]
                    },
                    { model: models_1.SchoolPeriod, as: 'period' },
                    { model: models_1.Grade, as: 'grade' },
                    { model: models_1.Section, as: 'section' },
                    { model: models_1.Subject, as: 'subjects', through: { attributes: [] } },
                    { model: models_1.Matriculation, as: 'matriculation', include: [{ model: models_1.EnrollmentDocument, as: 'documents' }] }
                ],
                // Preserve the canonical order from step 1 (Inscription.findAll with
                // where id IN (...) would otherwise return rows in PK order).
                order: [(0, sequelize_1.literal)((0, studentSortService_1.fieldExpr)((0, studentSortService_1.quoteQualified)('Inscription', 'id'), ids.map(String)))],
            });
        }
        else {
            inscriptions = [];
        }
        // Apply canonical subject order per inscription
        const orderMapCache = new Map();
        const resolveOrderMap = (gradeId, schoolPeriodId) => __awaiter(void 0, void 0, void 0, function* () {
            const key = `${gradeId}:${schoolPeriodId}`;
            if (orderMapCache.has(key))
                return orderMapCache.get(key);
            const m = yield (0, subjectOrderService_1.getSubjectOrderMapByGradeAndPeriod)(gradeId, schoolPeriodId);
            orderMapCache.set(key, m);
            return m;
        });
        const activeTermByPeriod = new Map();
        const activePeriods = [...new Set(inscriptions.map(ins => ins.schoolPeriodId))];
        if (activePeriods.length > 0) {
            const activeTerms = yield models_1.Term.findAll({
                where: { schoolPeriodId: activePeriods, isActive: true },
                attributes: ['id', 'schoolPeriodId'],
            });
            activeTerms.forEach(term => activeTermByPeriod.set(term.schoolPeriodId, term.id));
        }
        const result = yield Promise.all(inscriptions.map((ins) => __awaiter(void 0, void 0, void 0, function* () {
            const json = ins.toJSON();
            const activeTermId = activeTermByPeriod.get(ins.schoolPeriodId);
            if (activeTermId && Array.isArray(json.subjects)) {
                const choices = yield models_1.InscriptionGroupTermChoice.findAll({
                    where: { inscriptionId: ins.id, termId: activeTermId },
                    attributes: ['subjectGroupId', 'subjectId'],
                });
                const chosenByGroup = new Map(choices.map(choice => [choice.subjectGroupId, choice.subjectId]));
                if (chosenByGroup.size > 0) {
                    json.subjects = json.subjects.filter((subject) => subject.subjectGroupId == null || chosenByGroup.get(subject.subjectGroupId) === subject.id);
                }
            }
            if (json.student) {
                json.student.representativeType = deriveRepresentativeType(json.student.guardians);
            }
            if (Array.isArray(json.subjects) && json.subjects.length) {
                const orderMap = yield resolveOrderMap(json.gradeId, json.schoolPeriodId);
                json.subjects = (0, subjectOrderService_1.sortSubjectsByOrder)(json.subjects, (s) => s.id, (s) => s.name, orderMap);
            }
            return json;
        })));
        // When paginated, the hidden filter is already in SQL and the order is
        // already canonical from step 1, so we skip the in-memory sort/filter.
        // When unpaginated, preserve the exact legacy behavior (JS sort + JS filter
        // for non-privileged) so existing consumers see no difference.
        let finalResult = result;
        if (!pagination.isPaginated) {
            const filtered = isPrivileged
                ? result
                : result.filter((ins) => { var _a; return !((_a = ins.matriculation) === null || _a === void 0 ? void 0 : _a.hiddenFromControlEstudios); });
            (0, studentSortService_1.sortInscriptions)(filtered);
            finalResult = filtered;
        }
        res.json((0, paginationService_1.buildPaginatedResponse)(finalResult, total, pagination));
    }
    catch (error) {
        console.error('Error en getInscriptions:', error);
        res.status(500).json({ error: 'Error obteniendo inscripciones' });
    }
});
exports.getInscriptions = getInscriptions;
/**
 * GET /api/inscriptions/stats
 *
 * Returns aggregate counts for the same filter set accepted by
 * getInscriptions, so the frontend can show "N registros" and coverage
 * badges WITHOUT downloading the full row set.
 *
 * Response: { total, byGrade?: { gradeId, gradeName, count }[] }
 */
const getInscriptionsStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { schoolPeriodId, gradeId, sectionId, q, gender, escolaridad, hidden, includeAuxiliary } = req.query;
        const where = {};
        if (schoolPeriodId)
            where.schoolPeriodId = schoolPeriodId;
        if (gradeId)
            where.gradeId = gradeId;
        if (sectionId)
            where.sectionId = sectionId;
        if (escolaridad)
            where.escolaridad = escolaridad;
        const userRoles = ((_a = req.session.user) === null || _a === void 0 ? void 0 : _a.roles) || [];
        const isPrivileged = userRoles.includes('Master') || userRoles.includes('Administrador');
        const andConditions = [];
        const hiddenCol = (0, studentSortService_1.quoteQualified)('matriculation', 'hiddenFromControlEstudios');
        if (!isPrivileged) {
            andConditions.push((0, sequelize_1.literal)(`${hiddenCol} = false`));
        }
        else if (hidden !== undefined) {
            const hiddenBool = hidden === 'true' || hidden === '1';
            andConditions.push((0, sequelize_1.literal)(`${hiddenCol} = ${hiddenBool ? 'true' : 'false'}`));
        }
        // Exclude auxiliary "Materia Pendiente" inscriptions (same logic as getInscriptions)
        if (includeAuxiliary !== 'true' && sectionId === undefined) {
            const mpSection = yield models_1.Section.findOne({ where: { name: 'MATERIA PENDIENTE' } });
            if (mpSection) {
                andConditions.push({ sectionId: { [sequelize_1.Op.ne]: mpSection.id } });
            }
        }
        if (andConditions.length > 0) {
            where[sequelize_1.Op.and] = andConditions;
        }
        const personWhere = {};
        let hasPersonFilter = false;
        if (gender) {
            personWhere.gender = gender;
            hasPersonFilter = true;
        }
        if (q) {
            personWhere[sequelize_1.Op.or] = [
                { firstName: { [sequelize_1.Op.like]: `%${q}%` } },
                { lastName: { [sequelize_1.Op.like]: `%${q}%` } },
                { document: { [sequelize_1.Op.like]: `%${q}%` } }
            ];
            hasPersonFilter = true;
        }
        const include = [
            {
                model: models_1.Person,
                as: 'student',
                where: hasPersonFilter ? personWhere : undefined,
                required: hasPersonFilter,
                attributes: [],
            },
            { model: models_1.Matriculation, as: 'matriculation', attributes: [] },
        ];
        const total = yield models_1.Inscription.count({
            where,
            include,
            distinct: true,
            col: 'id',
        });
        // Optional breakdown by grade (used by coverage badges).
        let byGrade;
        if (!gradeId) {
            const rows = yield models_1.Inscription.findAll({
                where,
                attributes: [
                    [(0, sequelize_1.fn)('COALESCE', (0, sequelize_1.col)('grade.id'), (0, sequelize_1.literal)('NULL')), 'gradeId'],
                    [(0, sequelize_1.col)('grade.name'), 'gradeName'],
                    [(0, sequelize_1.fn)('COUNT', (0, sequelize_1.fn)('DISTINCT', (0, sequelize_1.col)('Inscription.id'))), 'count'],
                ],
                include: [...include, { model: models_1.Grade, as: 'grade', attributes: [] }],
                group: ['grade.id', 'grade.name'],
                raw: true,
                subQuery: false,
            });
            byGrade = rows.map(r => ({ gradeId: r.gradeId, gradeName: r.gradeName, count: Number(r.count) }));
        }
        return res.json(Object.assign({ total }, (byGrade ? { byGrade } : {})));
    }
    catch (error) {
        console.error('[getInscriptionsStats] Error:', error);
        return res.status(500).json({ error: 'Error obteniendo estadísticas de inscripciones' });
    }
});
exports.getInscriptionsStats = getInscriptionsStats;
/**
 * GET /api/matriculations/stats
 *
 * Same as above for matriculations.
 */
const getMatriculationsStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { status, schoolPeriodId, gradeId, sectionId, q, gender, escolaridad, hidden } = req.query;
        const where = {};
        if (status)
            where.status = status;
        if (schoolPeriodId)
            where.schoolPeriodId = schoolPeriodId;
        if (gradeId)
            where.gradeId = gradeId;
        if (sectionId)
            where.sectionId = sectionId;
        if (escolaridad)
            where.escolaridad = escolaridad;
        const userRoles = ((_a = req.session.user) === null || _a === void 0 ? void 0 : _a.roles) || [];
        const isPrivileged = userRoles.includes('Master') || userRoles.includes('Administrador');
        if (!isPrivileged) {
            where.hiddenFromControlEstudios = false;
        }
        else if (hidden !== undefined) {
            where.hiddenFromControlEstudios = hidden === 'true' || hidden === '1';
        }
        const studentWhere = {};
        let hasStudentFilter = false;
        if (q) {
            const like = `%${q}%`;
            studentWhere[sequelize_1.Op.or] = [
                { firstName: { [sequelize_1.Op.like]: like } },
                { lastName: { [sequelize_1.Op.like]: like } },
                { document: { [sequelize_1.Op.like]: like } }
            ];
            hasStudentFilter = true;
        }
        if (gender) {
            studentWhere.gender = gender;
            hasStudentFilter = true;
        }
        const total = yield models_1.Matriculation.count({
            where,
            include: [{
                    model: models_1.Person,
                    as: 'student',
                    where: hasStudentFilter ? studentWhere : undefined,
                    required: hasStudentFilter,
                    attributes: [],
                }],
            distinct: true,
            col: 'id',
        });
        return res.json({ total });
    }
    catch (error) {
        console.error('[getMatriculationsStats] Error:', error);
        return res.status(500).json({ error: 'Error obteniendo estadísticas de matriculaciones' });
    }
});
exports.getMatriculationsStats = getMatriculationsStats;
const getInscriptionById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const inscription = yield models_1.Inscription.findByPk(id, {
            include: [
                { model: models_1.Person, as: 'student' },
                { model: models_1.SchoolPeriod, as: 'period' },
                { model: models_1.Grade, as: 'grade' },
                { model: models_1.Section, as: 'section' },
                { model: models_1.Subject, as: 'subjects', through: { attributes: [] } }
            ]
        });
        if (!inscription)
            return res.status(404).json({ error: 'Inscripción no encontrada' });
        // Apply canonical subject order
        const json = inscription.toJSON();
        if (Array.isArray(json.subjects) && json.subjects.length) {
            const orderMap = yield (0, subjectOrderService_1.getSubjectOrderMapByGradeAndPeriod)(json.gradeId, json.schoolPeriodId);
            json.subjects = (0, subjectOrderService_1.sortSubjectsByOrder)(json.subjects, (s) => s.id, (s) => s.name, orderMap);
        }
        res.json(json);
    }
    catch (error) {
        res.status(500).json({ error: 'Error obteniendo inscripción', details: error });
    }
});
exports.getInscriptionById = getInscriptionById;
const createInscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const t = yield database_1.default.transaction();
    try {
        const { schoolPeriodId, gradeId, personId, sectionId, enrollmentAnswers, escolaridad, documents } = req.body;
        // 1. Verify Role Student
        const person = yield models_1.Person.findByPk(personId, {
            include: [{ model: models_1.Role, as: 'roles' }]
        });
        if (!person) {
            yield t.rollback();
            return res.status(404).json({ error: 'Persona no encontrada' });
        }
        // Check if user has 'student' role (case insensitive)
        const isStudent = (_a = person.roles) === null || _a === void 0 ? void 0 : _a.some((r) => r.name.toLowerCase() === 'student' ||
            r.name.toLowerCase() === 'estudiante' ||
            r.name.toLowerCase() === 'alumno');
        if (!isStudent) {
            yield t.rollback();
            return res.status(400).json({ error: 'La persona seleccionada no tiene el rol de estudiante' });
        }
        // 2. Check existence (student can only be enrolled once per period)
        const existing = yield models_1.Inscription.findOne({
            where: { schoolPeriodId, personId },
            transaction: t
        });
        if (existing) {
            yield t.rollback();
            return res.status(400).json({ error: 'El estudiante ya está inscrito en este periodo escolar' });
        }
        // 3. Create Matriculation (PENDING)
        if (Array.isArray(enrollmentAnswers)) {
            yield (0, enrollmentAnswerService_1.saveEnrollmentAnswers)(personId, enrollmentAnswers, { transaction: t });
        }
        const matriculation = yield models_1.Matriculation.create({
            schoolPeriodId,
            gradeId,
            sectionId: sectionId || null,
            personId,
            status: 'pending',
            escolaridad: normalizeEscolaridad(escolaridad)
        }, { transaction: t });
        // Documents
        if (documents) {
            yield models_1.EnrollmentDocument.create(Object.assign({ matriculationId: matriculation.id }, documents), { transaction: t });
        }
        let reportUuid;
        try {
            const report = yield (0, enrollmentReportService_1.generateEnrollmentReport)(matriculation.id, t);
            reportUuid = report.uuid;
        }
        catch (reportError) {
            console.warn('[createInscription] No se pudo generar reporte:', reportError);
        }
        yield t.commit();
        res.status(201).json({
            message: 'Solicitud de inscripción registrada exitosamente',
            matriculation,
            reportUuid
        });
    }
    catch (error) {
        yield t.rollback();
        res.status(500).json({ error: 'Error al inscribir', details: error.message || error });
    }
});
exports.createInscription = createInscription;
const updateInscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const t = yield database_1.default.transaction();
    try {
        const { id } = req.params;
        const { firstName, lastName, documentType, document, gender, birthdate, birthState, birthMunicipality, birthParish, residenceState, residenceMunicipality, residenceParish, address, phone1, phone2, email, whatsapp, previousSchoolIds, gradeId, sectionId, mother, father, representative, representativeType, enrollmentAnswers, escolaridad, subjectIds, fromTermId, } = req.body;
        const inscription = yield models_1.Inscription.findByPk(id, {
            include: [{ model: models_1.Person, as: 'student' }],
            transaction: t,
            lock: t.LOCK.UPDATE
        });
        if (!inscription) {
            yield t.rollback();
            return res.status(404).json({ error: 'Inscripción no encontrada' });
        }
        const person = inscription.student;
        if (!person) {
            yield t.rollback();
            return res.status(400).json({ error: 'No se encontró el estudiante asociado' });
        }
        console.log('[updateInscription] Person antes de actualizar:', {
            id: person.id,
            firstName: person.firstName,
            lastName: person.lastName
        });
        // Update Person Data if provided
        if (firstName)
            person.firstName = firstName;
        if (lastName)
            person.lastName = lastName;
        if (documentType)
            person.documentType = documentType;
        if (document !== undefined)
            person.document = document || null;
        if (gender)
            person.gender = gender;
        if (birthdate)
            person.birthdate = birthdate;
        console.log('[updateInscription] Person después de cambios (antes de save):', {
            id: person.id,
            firstName: person.firstName,
            lastName: person.lastName
        });
        yield person.save({ transaction: t });
        console.log('[updateInscription] Person guardado en BD');
        // Contact
        if (phone1 || phone2 || email || address || whatsapp) {
            const contactPayload = { personId: person.id };
            if (phone1 !== undefined)
                contactPayload.phone1 = phone1;
            if (phone2 !== undefined)
                contactPayload.phone2 = phone2;
            if (email !== undefined)
                contactPayload.email = email;
            if (address !== undefined)
                contactPayload.address = address;
            if (whatsapp !== undefined)
                contactPayload.whatsapp = whatsapp;
            const existingContact = yield models_1.Contact.findOne({ where: { personId: person.id }, transaction: t, lock: t.LOCK.UPDATE });
            if (existingContact) {
                yield existingContact.update(contactPayload, { transaction: t });
            }
            else {
                yield models_1.Contact.create(contactPayload, { transaction: t });
            }
        }
        // Residence
        if (birthState || birthMunicipality || birthParish || residenceState || residenceMunicipality || residenceParish) {
            const residencePayload = { personId: person.id };
            if (birthState)
                residencePayload.birthState = birthState;
            if (birthMunicipality)
                residencePayload.birthMunicipality = birthMunicipality;
            if (birthParish)
                residencePayload.birthParish = birthParish;
            if (residenceState)
                residencePayload.residenceState = residenceState;
            if (residenceMunicipality)
                residencePayload.residenceMunicipality = residenceMunicipality;
            if (residenceParish)
                residencePayload.residenceParish = residenceParish;
            const existingResidence = yield models_1.PersonResidence.findOne({ where: { personId: person.id }, transaction: t, lock: t.LOCK.UPDATE });
            if (existingResidence) {
                yield existingResidence.update(residencePayload, { transaction: t });
            }
            else {
                yield models_1.PersonResidence.create(residencePayload, { transaction: t });
            }
        }
        // Previous Schools
        if (Array.isArray(previousSchoolIds)) {
            yield models_1.StudentPreviousSchool.destroy({ where: { personId: person.id }, transaction: t });
            const schoolRecords = [];
            for (const item of previousSchoolIds) {
                const plantel = yield models_1.Plantel.findOne({
                    where: {
                        [sequelize_1.Op.or]: [{ code: item }, { name: item }]
                    },
                    transaction: t
                });
                schoolRecords.push({
                    personId: person.id,
                    plantelCode: (plantel === null || plantel === void 0 ? void 0 : plantel.code) || (typeof item === 'string' ? item : null),
                    plantelName: (plantel === null || plantel === void 0 ? void 0 : plantel.name) || (typeof item === 'string' ? item : 'Desconocido'),
                    state: (plantel === null || plantel === void 0 ? void 0 : plantel.state) || null,
                    dependency: (plantel === null || plantel === void 0 ? void 0 : plantel.dependency) || null
                });
            }
            if (schoolRecords.length > 0) {
                yield models_1.StudentPreviousSchool.bulkCreate(schoolRecords, { transaction: t });
            }
        }
        // Guardians
        const assignments = [];
        if (mother && hasGuardianData(mother)) {
            assignments.push({
                payload: mapToGuardianProfilePayload(mother),
                relationship: 'mother',
                isRepresentative: representativeType === 'mother'
            });
        }
        if (father && hasGuardianData(father)) {
            assignments.push({
                payload: mapToGuardianProfilePayload(father),
                relationship: 'father',
                isRepresentative: representativeType === 'father'
            });
        }
        if (representative && hasGuardianData(representative)) {
            const repRelationship = (representativeType === 'sibling' || representativeType === 'grandparent' || representativeType === 'uncle_aunt')
                ? representativeType
                : 'representative';
            assignments.push({
                payload: mapToGuardianProfilePayload(representative),
                relationship: repRelationship,
                isRepresentative: true
            });
        }
        if (assignments.length > 0) {
            yield (0, studentGuardianService_1.assignGuardians)(person.id, assignments, t);
        }
        // Enrollment Answers
        if (Array.isArray(enrollmentAnswers)) {
            yield (0, enrollmentAnswerService_1.saveEnrollmentAnswers)(person.id, enrollmentAnswers, { transaction: t });
        }
        // Escolaridad
        if (escolaridad !== undefined) {
            inscription.escolaridad = normalizeEscolaridad(escolaridad);
        }
        const oldGradeId = inscription.gradeId;
        // Update basic fields
        if (gradeId !== undefined)
            inscription.gradeId = gradeId;
        if (sectionId !== undefined)
            inscription.sectionId = sectionId;
        yield inscription.save({ transaction: t });
        // If grade changed, we MUST sync subjects
        if (gradeId !== undefined && Number(gradeId) !== Number(oldGradeId)) {
            // 1. Remove old subjects
            yield models_1.InscriptionSubject.destroy({
                where: { inscriptionId: id },
                transaction: t
            });
            // 2. Add subjects from the NEW grade structure
            const periodGrade = yield models_1.PeriodGrade.findOne({
                where: {
                    schoolPeriodId: inscription.schoolPeriodId,
                    gradeId: gradeId
                },
                include: [{ model: models_1.Subject, as: 'subjects', through: { where: { active: true } } }],
                transaction: t
            });
            if (periodGrade && periodGrade.subjects && periodGrade.subjects.length > 0) {
                console.log(`[UpdateInscription] Processing ${periodGrade.subjects.length} subjects for new grade ${gradeId}`);
                // Filter out subjects that belong to a group
                const subjectsToAdd = periodGrade.subjects
                    .filter((s) => {
                    const hasGroup = s.subjectGroupId !== null && s.subjectGroupId !== undefined;
                    if (hasGroup) {
                        console.log(`[UpdateInscription] Skipping subject ${s.name} (ID: ${s.id}) because it belongs to group ${s.subjectGroupId}`);
                    }
                    return !hasGroup;
                })
                    .map((s) => ({
                    inscriptionId: inscription.id,
                    subjectId: s.id,
                    schoolPeriodId: inscription.schoolPeriodId,
                    gradeId: gradeId,
                    sectionId: inscription.sectionId
                }));
                console.log(`[UpdateInscription] Enrolling in ${subjectsToAdd.length} subjects`);
                if (subjectsToAdd.length > 0) {
                    yield models_1.InscriptionSubject.bulkCreate(subjectsToAdd, { transaction: t });
                }
            }
        }
        // Handle group subject updates (when subjectIds is provided).
        //
        // Per-term choice semantics:
        //  - The change applies from the active term onwards.
        //  - Notes for the old subject are NEVER destroyed. They remain in the
        //    database and reappear if the student switches back. The professor
        //    manually enters notes for the new subject.
        //  - Terms before the active term are never touched.
        if (Array.isArray(subjectIds)) {
            console.log(`[UpdateInscription] Updating group subjects:`, subjectIds);
            const periodGrade = yield models_1.PeriodGrade.findOne({
                where: {
                    schoolPeriodId: inscription.schoolPeriodId,
                    gradeId: inscription.gradeId
                },
                include: [{ model: models_1.Subject, as: 'subjects', through: { where: { active: true } } }],
                transaction: t
            });
            if (periodGrade && periodGrade.subjects) {
                const groupSubjects = periodGrade.subjects.filter((s) => s.subjectGroupId != null);
                const selectedFromTerm = fromTermId != null
                    ? yield models_1.Term.findOne({
                        where: { id: Number(fromTermId), schoolPeriodId: inscription.schoolPeriodId },
                        transaction: t,
                    })
                    : yield models_1.Term.findOne({
                        where: { schoolPeriodId: inscription.schoolPeriodId, isActive: true },
                        transaction: t,
                    });
                if (selectedFromTerm) {
                    for (const subjectId of subjectIds) {
                        const subj = groupSubjects.find((s) => s.id === Number(subjectId));
                        if (!subj || subj.subjectGroupId == null)
                            continue;
                        yield (0, groupSubjectChoiceService_1.changeGroupSubjectFromTerm)(inscription.id, subj.subjectGroupId, subj.id, selectedFromTerm.id, { transaction: t });
                    }
                }
                else if (subjectIds.length > 0) {
                    // No active term — just ensure InscriptionSubject rows exist.
                    for (const subjectId of subjectIds) {
                        yield models_1.InscriptionSubject.findOrCreate({
                            where: { inscriptionId: inscription.id, subjectId: Number(subjectId) },
                            defaults: {
                                inscriptionId: inscription.id,
                                subjectId: Number(subjectId),
                                schoolPeriodId: inscription.schoolPeriodId,
                                gradeId: inscription.gradeId,
                                sectionId: inscription.sectionId,
                            },
                            transaction: t,
                        });
                    }
                }
            }
        }
        yield t.commit();
        res.json({ message: 'Datos actualizados correctamente', inscription });
    }
    catch (error) {
        if (t)
            yield t.rollback();
        console.error('Error updating inscription:', error);
        res.status(500).json({ error: 'Error actualizando inscripción', details: error.message || error });
    }
});
exports.updateInscription = updateInscription;
const deleteInscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const t = yield database_1.default.transaction();
    try {
        const { id } = req.params;
        const inscription = yield models_1.Inscription.findByPk(id);
        if (!inscription) {
            yield t.rollback();
            return res.status(404).json({ error: 'Inscripción no encontrada' });
        }
        // Remove subjects first (cascade might handle this, but explicit is safe)
        yield models_1.InscriptionSubject.destroy({ where: { inscriptionId: id }, transaction: t });
        yield inscription.destroy({ transaction: t });
        yield t.commit();
        res.json({ message: 'Inscripción eliminada' });
    }
    catch (error) {
        yield t.rollback();
        res.status(500).json({ error: 'Error eliminando inscripción', details: error });
    }
});
exports.deleteInscription = deleteInscription;
// Additional methods for manual subject management
const addSubjectToInscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params; // inscription id
        const { subjectId } = req.body;
        const inscription = yield models_1.Inscription.findByPk(id);
        if (!inscription)
            return res.status(404).json({ error: 'Inscripción no encontrada' });
        yield models_1.InscriptionSubject.create({
            inscriptionId: Number(id),
            subjectId,
            schoolPeriodId: inscription.schoolPeriodId,
            gradeId: inscription.gradeId,
            sectionId: inscription.sectionId,
        });
        res.json({ message: 'Materia agregada a la inscripción' });
    }
    catch (error) {
        res.status(500).json({ error: 'Error agregando materia', details: error.message });
    }
});
exports.addSubjectToInscription = addSubjectToInscription;
const removeSubjectFromInscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, subjectId } = req.params; // inscription id, subject id
        const deleted = yield models_1.InscriptionSubject.destroy({
            where: { inscriptionId: id, subjectId }
        });
        if (!deleted)
            return res.status(404).json({ error: 'Materia no encontrada en esta inscripción' });
        res.json({ message: 'Materia removida de la inscripción' });
    }
    catch (error) {
        res.status(500).json({ error: 'Error removiendo materia', details: error.message });
    }
});
exports.removeSubjectFromInscription = removeSubjectFromInscription;
// Register a new student (Person without User) and enroll them
const registerAndEnroll = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { person, matriculation, reportUuid } = yield (0, studentEnrollmentService_1.registerAndEnrollStudent)(req.body);
        res.status(201).json({
            message: 'Solicitud de inscripción registrada exitosamente',
            person,
            matriculation,
            reportUuid
        });
    }
    catch (error) {
        console.error('[registerAndEnroll] Error:', error);
        res.status(500).json({ error: 'Error al registrar e inscribir', details: error.message || error });
    }
});
exports.registerAndEnroll = registerAndEnroll;
const updateMatriculation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const t = yield database_1.default.transaction();
    try {
        const { id } = req.params;
        const { firstName, lastName, documentType, document, gender, birthdate, birthState, birthMunicipality, birthParish, residenceState, residenceMunicipality, residenceParish, address, phone1, phone2, email, whatsapp, previousSchoolIds, gradeId, sectionId, mother, father, representative, representativeType, enrollmentAnswers, escolaridad, pathology, livingWith, documents, subjectIds } = req.body;
        const matriculation = (yield models_1.Matriculation.findByPk(id, {
            include: [
                { model: models_1.Person, as: 'student' },
                { model: models_1.Inscription, as: 'inscription' }
            ],
            transaction: t,
            lock: t.LOCK.UPDATE
        }));
        if (!matriculation) {
            yield t.rollback();
            return res.status(404).json({ error: 'Matriculación no encontrada' });
        }
        const person = matriculation.student;
        if (!person) {
            yield t.rollback();
            return res.status(400).json({ error: 'No se encontró el estudiante asociado' });
        }
        console.log('[updateMatriculation] Person antes de actualizar:', {
            id: person.id,
            firstName: person.firstName,
            lastName: person.lastName
        });
        // Update Person Data if provided
        if (firstName)
            person.firstName = firstName;
        if (lastName)
            person.lastName = lastName;
        if (documentType)
            person.documentType = documentType;
        if (document !== undefined)
            person.document = document || null;
        if (gender)
            person.gender = gender;
        if (birthdate)
            person.birthdate = birthdate;
        if (pathology !== undefined)
            person.pathology = pathology;
        if (livingWith !== undefined)
            person.livingWith = livingWith;
        console.log('[updateMatriculation] Person después de cambios (antes de save):', {
            id: person.id,
            firstName: person.firstName,
            lastName: person.lastName
        });
        yield person.save({ transaction: t });
        console.log('[updateMatriculation] Person guardado en BD');
        // Contact
        if (phone1 || phone2 || email || address || whatsapp) {
            const contactPayload = { personId: person.id };
            if (phone1 !== undefined)
                contactPayload.phone1 = phone1;
            if (phone2 !== undefined)
                contactPayload.phone2 = phone2;
            if (email !== undefined)
                contactPayload.email = email;
            if (address !== undefined)
                contactPayload.address = address;
            if (whatsapp !== undefined)
                contactPayload.whatsapp = whatsapp;
            const existingContact = yield models_1.Contact.findOne({ where: { personId: person.id }, transaction: t, lock: t.LOCK.UPDATE });
            if (existingContact) {
                yield existingContact.update(contactPayload, { transaction: t });
            }
            else {
                yield models_1.Contact.create(contactPayload, { transaction: t });
            }
        }
        // Residence
        if (birthState || birthMunicipality || birthParish || residenceState || residenceMunicipality || residenceParish) {
            const residencePayload = { personId: person.id };
            if (birthState)
                residencePayload.birthState = birthState;
            if (birthMunicipality)
                residencePayload.birthMunicipality = birthMunicipality;
            if (birthParish)
                residencePayload.birthParish = birthParish;
            if (residenceState)
                residencePayload.residenceState = residenceState;
            if (residenceMunicipality)
                residencePayload.residenceMunicipality = residenceMunicipality;
            if (residenceParish)
                residencePayload.residenceParish = residenceParish;
            if (address)
                residencePayload.address = address;
            const existingResidence = yield models_1.PersonResidence.findOne({ where: { personId: person.id }, transaction: t, lock: t.LOCK.UPDATE });
            if (existingResidence) {
                yield existingResidence.update(residencePayload, { transaction: t });
            }
            else {
                yield models_1.PersonResidence.create(residencePayload, { transaction: t });
            }
        }
        // Previous Schools
        if (Array.isArray(previousSchoolIds)) {
            yield models_1.StudentPreviousSchool.destroy({ where: { personId: person.id }, transaction: t });
            const schoolRecords = [];
            for (const item of previousSchoolIds) {
                const plantel = yield models_1.Plantel.findOne({
                    where: {
                        [sequelize_1.Op.or]: [{ code: item }, { name: item }]
                    },
                    transaction: t
                });
                schoolRecords.push({
                    personId: person.id,
                    plantelCode: (plantel === null || plantel === void 0 ? void 0 : plantel.code) || (typeof item === 'string' ? item : null),
                    plantelName: (plantel === null || plantel === void 0 ? void 0 : plantel.name) || (typeof item === 'string' ? item : 'Desconocido'),
                    state: (plantel === null || plantel === void 0 ? void 0 : plantel.state) || null,
                    dependency: (plantel === null || plantel === void 0 ? void 0 : plantel.dependency) || null
                });
            }
            if (schoolRecords.length > 0) {
                yield models_1.StudentPreviousSchool.bulkCreate(schoolRecords, { transaction: t });
            }
        }
        // Guardians - Simplified for partial updates
        const assignments = [];
        if (mother && hasGuardianData(mother)) {
            assignments.push({
                payload: mapToGuardianProfilePayload(mother),
                relationship: 'mother',
                isRepresentative: representativeType === 'mother'
            });
        }
        if (father && hasGuardianData(father)) {
            assignments.push({
                payload: mapToGuardianProfilePayload(father),
                relationship: 'father',
                isRepresentative: representativeType === 'father'
            });
        }
        if (representative && hasGuardianData(representative)) {
            const repRelationship = (representativeType === 'sibling' || representativeType === 'grandparent' || representativeType === 'uncle_aunt')
                ? representativeType
                : 'representative';
            assignments.push({
                payload: mapToGuardianProfilePayload(representative),
                relationship: repRelationship,
                isRepresentative: true
            });
        }
        if (assignments.length > 0) {
            yield (0, studentGuardianService_1.assignGuardians)(person.id, assignments, t);
        }
        // Enrollment Answers
        if (Array.isArray(enrollmentAnswers)) {
            yield (0, enrollmentAnswerService_1.saveEnrollmentAnswers)(person.id, enrollmentAnswers, { transaction: t });
        }
        // Grade, Section, Escolaridad
        if (escolaridad !== undefined) {
            const escolaridadValue = normalizeEscolaridad(escolaridad);
            matriculation.escolaridad = escolaridadValue;
            if (matriculation.inscription) {
                matriculation.inscription.escolaridad = escolaridadValue;
                yield matriculation.inscription.save({ transaction: t });
            }
        }
        if (gradeId !== undefined)
            matriculation.gradeId = gradeId;
        if (sectionId !== undefined)
            matriculation.sectionId = sectionId;
        yield matriculation.save({ transaction: t });
        // Sync Inscription if it exists (completed status)
        if (matriculation.status === 'completed' && matriculation.inscription) {
            const inscription = matriculation.inscription;
            const oldGradeId = inscription.gradeId;
            if (gradeId !== undefined)
                inscription.gradeId = gradeId;
            if (sectionId !== undefined)
                inscription.sectionId = sectionId;
            yield inscription.save({ transaction: t });
            // If grade changed, sync subjects
            if (gradeId !== undefined && Number(gradeId) !== Number(oldGradeId)) {
                yield models_1.InscriptionSubject.destroy({
                    where: { inscriptionId: inscription.id },
                    transaction: t
                });
                const periodGrade = yield models_1.PeriodGrade.findOne({
                    where: {
                        schoolPeriodId: inscription.schoolPeriodId,
                        gradeId: gradeId
                    },
                    include: [{ model: models_1.Subject, as: 'subjects', through: { where: { active: true } } }],
                    transaction: t
                });
                if (periodGrade && periodGrade.subjects && periodGrade.subjects.length > 0) {
                    const subjectsToAdd = periodGrade.subjects
                        .filter((s) => !s.subjectGroupId)
                        .map((s) => ({
                        inscriptionId: inscription.id,
                        subjectId: s.id,
                        schoolPeriodId: inscription.schoolPeriodId,
                        gradeId: gradeId,
                        sectionId: inscription.sectionId
                    }));
                    if (subjectsToAdd.length > 0) {
                        yield models_1.InscriptionSubject.bulkCreate(subjectsToAdd, { transaction: t });
                    }
                }
            }
            // Handle group subject updates (when subjectIds is provided).
            // Same per-term logic as updateInscription: change applies from the
            // active term onwards. Notes are never destroyed.
            if (Array.isArray(subjectIds)) {
                const periodGrade = yield models_1.PeriodGrade.findOne({
                    where: {
                        schoolPeriodId: inscription.schoolPeriodId,
                        gradeId: inscription.gradeId
                    },
                    include: [{ model: models_1.Subject, as: 'subjects', through: { where: { active: true } } }],
                    transaction: t
                });
                if (periodGrade && periodGrade.subjects) {
                    const groupSubjects = periodGrade.subjects.filter((s) => s.subjectGroupId != null);
                    const activeTerm = yield models_1.Term.findOne({
                        where: { schoolPeriodId: inscription.schoolPeriodId, isActive: true },
                        transaction: t,
                    });
                    if (activeTerm) {
                        for (const subjectId of subjectIds) {
                            const subj = groupSubjects.find((s) => s.id === Number(subjectId));
                            if (!subj || subj.subjectGroupId == null)
                                continue;
                            yield (0, groupSubjectChoiceService_1.changeGroupSubjectFromTerm)(inscription.id, subj.subjectGroupId, subj.id, activeTerm.id, { transaction: t });
                        }
                    }
                    else if (subjectIds.length > 0) {
                        for (const subjectId of subjectIds) {
                            yield models_1.InscriptionSubject.findOrCreate({
                                where: { inscriptionId: inscription.id, subjectId: Number(subjectId) },
                                defaults: {
                                    inscriptionId: inscription.id,
                                    subjectId: Number(subjectId),
                                    schoolPeriodId: inscription.schoolPeriodId,
                                    gradeId: inscription.gradeId,
                                    sectionId: inscription.sectionId,
                                },
                                transaction: t,
                            });
                        }
                    }
                }
            }
        }
        // Documents
        if (documents) {
            const docRecord = yield models_1.EnrollmentDocument.findOne({ where: { matriculationId: matriculation.id }, transaction: t });
            if (docRecord) {
                yield docRecord.update(documents, { transaction: t });
            }
            else {
                yield models_1.EnrollmentDocument.create(Object.assign({ matriculationId: matriculation.id }, documents), { transaction: t });
            }
        }
        yield t.commit();
        res.json({ message: 'Datos actualizados correctamente', matriculation });
    }
    catch (error) {
        if (t)
            yield t.rollback();
        console.error('Error updating matriculation:', error);
        res.status(500).json({ error: 'Error actualizando datos', details: error.message || error });
    }
});
exports.updateMatriculation = updateMatriculation;
const isPrivilegedUser = (req) => {
    var _a;
    const roles = ((_a = req.session.user) === null || _a === void 0 ? void 0 : _a.roles) || [];
    return roles.includes('Master') || roles.includes('Administrador');
};
const canEnrollStudent = (req) => {
    var _a;
    const roles = ((_a = req.session.user) === null || _a === void 0 ? void 0 : _a.roles) || [];
    return roles.includes('Master') || roles.includes('Administrador');
};
const toggleMatriculationVisibility = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isPrivilegedUser(req)) {
            return res.status(403).json({ error: 'Solo Administradores y Master pueden cambiar la visibilidad' });
        }
        const { id } = req.params;
        const { hidden } = req.body;
        if (typeof hidden !== 'boolean') {
            return res.status(400).json({ error: 'El campo "hidden" debe ser booleano' });
        }
        const matriculation = yield models_1.Matriculation.findByPk(id);
        if (!matriculation) {
            return res.status(404).json({ error: 'Matrícula no encontrada' });
        }
        yield matriculation.update({ hiddenFromControlEstudios: hidden });
        res.json({ message: hidden ? 'Estudiante ocultado de Control de Estudios' : 'Estudiante visible para Control de Estudios', hiddenFromControlEstudios: hidden });
    }
    catch (error) {
        console.error('Error toggling visibility:', error);
        res.status(500).json({ error: 'Error al cambiar visibilidad', details: error.message || error });
    }
});
exports.toggleMatriculationVisibility = toggleMatriculationVisibility;
const bulkToggleMatriculationVisibility = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isPrivilegedUser(req)) {
            return res.status(403).json({ error: 'Solo Administradores y Master pueden cambiar la visibilidad' });
        }
        const { ids, hidden } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'Se requiere un array de ids no vacío' });
        }
        if (typeof hidden !== 'boolean') {
            return res.status(400).json({ error: 'El campo "hidden" debe ser booleano' });
        }
        const [updatedCount] = yield models_1.Matriculation.update({ hiddenFromControlEstudios: hidden }, { where: { id: ids } });
        res.json({
            message: hidden
                ? `${updatedCount} estudiante(s) ocultado(s) de Control de Estudios`
                : `${updatedCount} estudiante(s) visible(s) para Control de Estudios`,
            updatedCount
        });
    }
    catch (error) {
        console.error('Error bulk toggling visibility:', error);
        res.status(500).json({ error: 'Error al cambiar visibilidad masiva', details: error.message || error });
    }
});
exports.bulkToggleMatriculationVisibility = bulkToggleMatriculationVisibility;
// ─── Per-term group subject choices ──────────────────────────────────────
/**
 * GET /api/inscriptions/:id/group-choices
 * Returns the per-term subject choices for every group the student is
 * enrolled in, plus the list of terms and available subjects per group.
 */
const getGroupSubjectChoices = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const inscription = yield models_1.Inscription.findByPk(id);
        if (!inscription)
            return res.status(404).json({ error: 'Inscripción no encontrada' });
        const [terms, choices, periodGrade] = yield Promise.all([
            models_1.Term.findAll({
                where: { schoolPeriodId: inscription.schoolPeriodId },
                order: [['order', 'ASC']],
            }),
            models_1.InscriptionGroupTermChoice.findAll({ where: { inscriptionId: Number(id) } }),
            models_1.PeriodGrade.findOne({
                where: { schoolPeriodId: inscription.schoolPeriodId, gradeId: inscription.gradeId },
                include: [{
                        model: models_1.Subject,
                        as: 'subjects',
                        through: { where: { active: true } },
                        include: [{ model: models_1.SubjectGroup, as: 'subjectGroup' }],
                    }],
            }),
        ]);
        const groupSubjects = ((periodGrade === null || periodGrade === void 0 ? void 0 : periodGrade.subjects) || []).filter((s) => s.subjectGroupId != null);
        const groups = [];
        const seen = new Map();
        for (const s of groupSubjects) {
            const gid = s.subjectGroupId;
            let g = seen.get(gid);
            if (!g) {
                g = { id: gid, name: ((_a = s.subjectGroup) === null || _a === void 0 ? void 0 : _a.name) || `Grupo ${gid}`, subjects: [] };
                seen.set(gid, g);
                groups.push(g);
            }
            g.subjects.push({ id: s.id, name: s.name });
        }
        res.json({
            terms: terms.map(t => ({ id: t.id, name: t.name, order: t.order, isActive: t.isActive })),
            groups,
            choices: choices.map(c => ({
                termId: c.termId,
                subjectGroupId: c.subjectGroupId,
                subjectId: c.subjectId,
            })),
        });
    }
    catch (error) {
        console.error('[getGroupSubjectChoices] Error:', error);
        res.status(500).json({ error: 'Error al obtener elecciones de grupo', details: error.message });
    }
});
exports.getGroupSubjectChoices = getGroupSubjectChoices;
/**
 * PUT /api/inscriptions/:id/group-choices
 * Body: { subjectGroupId, termId, subjectId }
 * Explicitly sets the subject for a single term (backfill UI).
 */
const setGroupSubjectForTerm = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const t = yield database_1.default.transaction();
    try {
        const { id } = req.params;
        const { subjectGroupId, termId, subjectId } = req.body;
        if (!subjectGroupId || !termId || !subjectId) {
            yield t.rollback();
            return res.status(400).json({ error: 'subjectGroupId, termId y subjectId son obligatorios' });
        }
        yield (0, groupSubjectChoiceService_1.setGroupSubjectForTerm)(Number(id), Number(subjectGroupId), Number(termId), Number(subjectId), { transaction: t });
        yield t.commit();
        res.json({ message: 'Elección de materia guardada correctamente' });
    }
    catch (error) {
        if (t)
            yield t.rollback();
        console.error('[setGroupSubjectForTerm] Error:', error);
        res.status(500).json({ error: 'Error al guardar la elección', details: error.message });
    }
});
exports.setGroupSubjectForTerm = setGroupSubjectForTerm;
/**
 * POST /api/inscriptions/:id/group-choices/check
 * Body: { subjectId }
 * Pre-flight check: tells the frontend whether the student already has notes
 * for their current group subject in the active term. Notes are NEVER
 * destroyed by a switch — this endpoint exists only so the UI can inform the
 * user that the old notes exist and will be hidden (but preserved) until the
 * student switches back.
 */
const checkGroupSubjectChangeImpact = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const { subjectId } = req.body;
        if (!subjectId)
            return res.status(400).json({ error: 'subjectId es obligatorio' });
        const inscription = yield models_1.Inscription.findByPk(id);
        if (!inscription)
            return res.status(404).json({ error: 'Inscripción no encontrada' });
        const activeTerm = yield models_1.Term.findOne({
            where: { schoolPeriodId: inscription.schoolPeriodId, isActive: true },
        });
        if (!activeTerm) {
            return res.json({ hasNotesInActiveTerm: false, activeTermId: null, currentSubjectId: null });
        }
        const currentChoice = yield models_1.InscriptionGroupTermChoice.findOne({
            where: { inscriptionId: Number(id), termId: activeTerm.id },
        });
        if (!currentChoice || currentChoice.subjectId === Number(subjectId)) {
            return res.json({ hasNotesInActiveTerm: false, activeTermId: activeTerm.id, currentSubjectId: (_a = currentChoice === null || currentChoice === void 0 ? void 0 : currentChoice.subjectId) !== null && _a !== void 0 ? _a : null });
        }
        const oldInsSubj = yield models_1.InscriptionSubject.findOne({
            where: { inscriptionId: Number(id), subjectId: currentChoice.subjectId },
        });
        let hasNotes = false;
        if (oldInsSubj) {
            const tg = yield models_1.SubjectTermGrade.findOne({
                where: { inscriptionSubjectId: oldInsSubj.id, termId: activeTerm.id },
            });
            hasNotes = !!tg;
        }
        res.json({
            hasNotesInActiveTerm: hasNotes,
            activeTermId: activeTerm.id,
            currentSubjectId: currentChoice.subjectId,
        });
    }
    catch (error) {
        console.error('[checkGroupSubjectChangeImpact] Error:', error);
        res.status(500).json({ error: 'Error al verificar impacto', details: error.message });
    }
});
exports.checkGroupSubjectChangeImpact = checkGroupSubjectChangeImpact;
/**
 * Un-matriculate a student: send them back from "Matriculados" to "No Matriculados".
 * Sets matriculation status back to 'pending' and clears sectionId on both
 * the inscription and the matriculation. The inscription and ALL academic data
 * (subjects, grades, etc.) are preserved — the student simply disappears from
 * the "Matriculados" list and reappears in "No Matriculados".
 */
const unmatriculateInscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!canEnrollStudent(req)) {
        return res.status(403).json({ error: 'No tiene permisos para realizar esta acción' });
    }
    const t = yield database_1.default.transaction();
    try {
        const { id } = req.params;
        const inscription = yield models_1.Inscription.findByPk(id, { transaction: t });
        if (!inscription) {
            yield t.rollback();
            return res.status(404).json({ error: 'Inscripción no encontrada' });
        }
        const matriculation = yield models_1.Matriculation.findOne({
            where: { inscriptionId: id },
            transaction: t
        });
        if (!matriculation) {
            yield t.rollback();
            return res.status(404).json({ error: 'Matrícula no encontrada' });
        }
        if (matriculation.status === 'withdrawn') {
            yield t.rollback();
            return res.status(400).json({ error: 'El estudiante está retirado, no se puede sacar de matrícula' });
        }
        // Clear section on inscription (keep the inscription itself!)
        inscription.sectionId = null;
        yield inscription.save({ transaction: t });
        // Set matriculation back to pending so the student reappears in "No Matriculados"
        matriculation.status = 'pending';
        matriculation.sectionId = null;
        yield matriculation.save({ transaction: t });
        yield t.commit();
        res.json({ message: 'Estudiante enviado a No Matriculados correctamente' });
    }
    catch (error) {
        yield t.rollback();
        console.error('[unmatriculateInscription] Error:', error);
        res.status(500).json({ error: 'Error al sacar de matrícula', details: error.message });
    }
});
exports.unmatriculateInscription = unmatriculateInscription;
/**
 * Withdraw a student: marks matriculation status as 'withdrawn' and clears sectionId.
 * All academic data (subjects, grades, etc.) is preserved.
 */
const withdrawInscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!canEnrollStudent(req)) {
        return res.status(403).json({ error: 'No tiene permisos para retirar estudiantes' });
    }
    const t = yield database_1.default.transaction();
    try {
        const { id } = req.params;
        const inscription = yield models_1.Inscription.findByPk(id, { transaction: t });
        if (!inscription) {
            yield t.rollback();
            return res.status(404).json({ error: 'Inscripción no encontrada' });
        }
        // Check if already withdrawn via matriculation status
        const matriculation = yield models_1.Matriculation.findOne({
            where: { inscriptionId: id },
            transaction: t
        });
        if (!matriculation) {
            yield t.rollback();
            return res.status(404).json({ error: 'Matrícula no encontrada' });
        }
        if (matriculation.status === 'withdrawn') {
            yield t.rollback();
            return res.status(400).json({ error: 'El estudiante ya está retirado' });
        }
        inscription.sectionId = null;
        inscription.withdrawnAt = new Date();
        yield inscription.save({ transaction: t });
        matriculation.status = 'withdrawn';
        matriculation.sectionId = null;
        yield matriculation.save({ transaction: t });
        yield t.commit();
        res.json({ message: 'Estudiante retirado de la sección correctamente' });
    }
    catch (error) {
        yield t.rollback();
        console.error('[withdrawInscription] Error:', error);
        res.status(500).json({ error: 'Error al retirar estudiante', details: error.message });
    }
});
exports.withdrawInscription = withdrawInscription;
/**
 * Reactivate a previously withdrawn student.
 * Only allowed during the same school period in which they were withdrawn.
 * Requires a sectionId to reassign the student to.
 */
const reactivateInscription = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!canEnrollStudent(req)) {
        return res.status(403).json({ error: 'No tiene permisos para reactivar estudiantes' });
    }
    const t = yield database_1.default.transaction();
    try {
        const { id } = req.params;
        const { sectionId } = req.body;
        if (!sectionId) {
            yield t.rollback();
            return res.status(400).json({ error: 'Debe especificar una sección para reactivar el estudiante' });
        }
        const inscription = yield models_1.Inscription.findByPk(id, { transaction: t });
        if (!inscription) {
            yield t.rollback();
            return res.status(404).json({ error: 'Inscripción no encontrada' });
        }
        const matriculation = yield models_1.Matriculation.findOne({
            where: { inscriptionId: id },
            transaction: t
        });
        if (!matriculation) {
            yield t.rollback();
            return res.status(404).json({ error: 'Matrícula no encontrada' });
        }
        if (matriculation.status !== 'withdrawn') {
            yield t.rollback();
            return res.status(400).json({ error: 'El estudiante no está retirado' });
        }
        // Verify the school period is still the active one
        const activePeriod = yield models_1.SchoolPeriod.findOne({
            where: { status: 'activo' },
            transaction: t
        });
        if (!activePeriod || activePeriod.id !== inscription.schoolPeriodId) {
            yield t.rollback();
            return res.status(400).json({
                error: 'No se puede reactivar: el período escolar ha cambiado. El estudiante debe reinscribirse.'
            });
        }
        inscription.sectionId = sectionId;
        inscription.withdrawnAt = null;
        yield inscription.save({ transaction: t });
        matriculation.status = 'completed';
        matriculation.sectionId = sectionId;
        yield matriculation.save({ transaction: t });
        yield t.commit();
        res.json({ message: 'Estudiante reactivado correctamente' });
    }
    catch (error) {
        yield t.rollback();
        console.error('[reactivateInscription] Error:', error);
        res.status(500).json({ error: 'Error al reactivar estudiante', details: error.message });
    }
});
exports.reactivateInscription = reactivateInscription;
