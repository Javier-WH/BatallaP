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
exports.registerAndEnrollStudent = exports.mapToGuardianProfilePayload = exports.validateGuardianPayload = exports.hasGuardianData = exports.normalizeEscolaridad = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const index_1 = require("../models/index.js");
const enrollmentAnswerService_1 = require("./enrollmentAnswerService.js");
const studentGuardianService_1 = require("./studentGuardianService.js");
const enrollmentReportService_1 = require("./enrollmentReportService.js");
const ESCOLARIDAD_VALUES = ['regular', 'repitiente', 'materia_pendiente'];
const normalizeEscolaridad = (value) => {
    if (typeof value !== 'string')
        return 'regular';
    const normalized = value.trim().toLowerCase();
    if (ESCOLARIDAD_VALUES.includes(normalized)) {
        return normalized;
    }
    throw new Error('Valor de escolaridad inválido. Debe ser regular, repitiente o materia_pendiente.');
};
exports.normalizeEscolaridad = normalizeEscolaridad;
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
// Fields that can be relaxed (made optional) in the bulk enrollment flow
const guardianContactFields = ['address', 'phone', 'email'];
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
exports.hasGuardianData = hasGuardianData;
const validateGuardianPayload = (label, data, required, options) => {
    var _a, _b, _c;
    const hasData = (0, exports.hasGuardianData)(data);
    if (!hasData) {
        if (required) {
            throw new Error(`Los datos de ${label} son obligatorios.`);
        }
        return null;
    }
    if (!required) {
        const hasIdentity = !isEmptyValue(data === null || data === void 0 ? void 0 : data.firstName) ||
            !isEmptyValue(data === null || data === void 0 ? void 0 : data.lastName) ||
            !isEmptyValue(data === null || data === void 0 ? void 0 : data.document);
        if (!hasIdentity) {
            return null;
        }
    }
    const requiredFields = (options === null || options === void 0 ? void 0 : options.relaxContactFields)
        ? guardianRequiredFields.filter((f) => !guardianContactFields.includes(f))
        : guardianRequiredFields;
    const missingFields = requiredFields.filter((field) => isEmptyValue(data === null || data === void 0 ? void 0 : data[field]));
    if (missingFields.length > 0) {
        throw new Error(`Faltan campos obligatorios para ${label}: ${missingFields.join(', ')}`);
    }
    // Fill relaxed contact fields with empty string so the model's allowNull: false is satisfied
    if ((options === null || options === void 0 ? void 0 : options.relaxContactFields) && data) {
        return Object.assign(Object.assign({}, data), { address: (_a = data.address) !== null && _a !== void 0 ? _a : '', phone: (_b = data.phone) !== null && _b !== void 0 ? _b : '', email: (_c = data.email) !== null && _c !== void 0 ? _c : '' });
    }
    return data;
};
exports.validateGuardianPayload = validateGuardianPayload;
const mapToGuardianProfilePayload = (data) => {
    var _a, _b;
    return ({
        firstName: data.firstName,
        lastName: data.lastName,
        documentType: data.documentType,
        document: data.document,
        phone: data.phone,
        phone2: (_a = data.phone2) !== null && _a !== void 0 ? _a : '',
        whatsapp: (_b = data.whatsapp) !== null && _b !== void 0 ? _b : '',
        email: data.email,
        residenceState: data.residenceState,
        residenceMunicipality: data.residenceMunicipality,
        residenceParish: data.residenceParish,
        address: data.address,
        occupation: data.occupation
    });
};
exports.mapToGuardianProfilePayload = mapToGuardianProfilePayload;
const toOptionalString = (value) => typeof value === 'string' && value.trim().length > 0 ? value : undefined;
const toOptionalStringArray = (value) => {
    if (!Array.isArray(value))
        return undefined;
    const cleaned = value.filter((item) => typeof item === 'string' && item.trim().length > 0);
    return cleaned.length > 0 ? cleaned : undefined;
};
const registerAndEnrollStudent = (payload, options) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const t = (_a = options === null || options === void 0 ? void 0 : options.transaction) !== null && _a !== void 0 ? _a : yield database_1.default.transaction();
    const relaxGuardianContactFields = (_b = options === null || options === void 0 ? void 0 : options.relaxGuardianContactFields) !== null && _b !== void 0 ? _b : false;
    try {
        const { firstName, lastName, documentType, document, nationality, gender, birthdate, pathology, livingWith, birthState, birthMunicipality, birthParish, residenceState, residenceMunicipality, residenceParish, mother, father, representative, representativeType, phone1, phone2, email, address, whatsapp, previousSchoolIds, schoolPeriodId, gradeId, sectionId, enrollmentAnswers, escolaridad, documents } = payload;
        if (!firstName || !lastName || !documentType || !gender || !birthdate) {
            throw new Error('Datos básicos del estudiante incompletos');
        }
        if (!schoolPeriodId || !gradeId) {
            throw new Error('El periodo escolar y el grado son obligatorios');
        }
        if (!birthState || !birthMunicipality || !birthParish || !residenceState || !residenceMunicipality || !residenceParish) {
            throw new Error('Datos de nacimiento y residencia son obligatorios para registrar estudiantes.');
        }
        let finalDocument = document !== null && document !== void 0 ? document : undefined;
        if (documentType === 'Cedula Escolar' && (!finalDocument || finalDocument.trim() === '')) {
            if (!mother || !mother.document) {
                throw new Error('La cédula de la madre es obligatoria para generar la Cédula Escolar.');
            }
            const nationalityChar = nationality === 'Extranjero' ? 'E' : 'V';
            let birthOrder = 1;
            const motherProfile = yield index_1.GuardianProfile.findOne({
                where: { document: mother.document },
                transaction: t
            });
            if (motherProfile) {
                const childrenCount = yield index_1.StudentGuardian.count({
                    where: { guardianId: motherProfile.id, relationship: 'mother' },
                    transaction: t
                });
                birthOrder = childrenCount + 1;
            }
            const birthYear = birthdate ? new Date(birthdate).getFullYear().toString().slice(-2) : '00';
            finalDocument = `${nationalityChar}${birthOrder}${birthYear}${mother.document}`;
        }
        const allowedDocumentTypes = ['Venezolano', 'Extranjero', 'Pasaporte', 'Cedula Escolar'];
        const sanitizedDocumentType = (allowedDocumentTypes.includes(documentType)
            ? documentType
            : 'Venezolano');
        const parsedBirthdate = new Date(birthdate);
        if (Number.isNaN(parsedBirthdate.getTime())) {
            throw new Error('Fecha de nacimiento inválida');
        }
        const personPayload = {
            firstName,
            lastName,
            documentType: sanitizedDocumentType,
            document: finalDocument !== null && finalDocument !== void 0 ? finalDocument : '',
            gender,
            birthdate: parsedBirthdate,
            userId: null
        };
        if (typeof pathology === 'string' && pathology.trim()) {
            personPayload.pathology = pathology;
        }
        if (typeof livingWith === 'string' && livingWith.trim()) {
            personPayload.livingWith = livingWith;
        }
        const person = yield index_1.Person.create(personPayload, { transaction: t });
        const validRepresentativeTypes = ['mother', 'father', 'sibling', 'grandparent', 'uncle_aunt', 'other'];
        const representativeSelection = typeof representativeType === 'string' && validRepresentativeTypes.includes(representativeType)
            ? representativeType
            : 'mother';
        const motherIsRepresentative = representativeSelection === 'mother';
        const fatherIsRepresentative = representativeSelection === 'father';
        const representativeDataRequired = !motherIsRepresentative && !fatherIsRepresentative;
        const motherDataRequired = motherIsRepresentative || (documentType === 'Cedula Escolar' && (!finalDocument || !finalDocument.trim()));
        const fatherDataRequired = fatherIsRepresentative;
        const motherData = (0, exports.validateGuardianPayload)('la madre', mother, motherDataRequired, { relaxContactFields: relaxGuardianContactFields });
        const fatherData = (0, exports.validateGuardianPayload)('el padre', father, fatherDataRequired, { relaxContactFields: relaxGuardianContactFields });
        const representativeData = (0, exports.validateGuardianPayload)('el representante', representative, representativeDataRequired, { relaxContactFields: relaxGuardianContactFields });
        if (!motherIsRepresentative && !fatherIsRepresentative && !representativeData) {
            throw new Error('Debe registrar un representante si la madre o el padre no lo son.');
        }
        // Inherit phone from the representative if not explicitly provided.
        const repForContact = representativeData || (motherIsRepresentative ? motherData : null) || (fatherIsRepresentative ? fatherData : null);
        const inheritedPhone = (repForContact === null || repForContact === void 0 ? void 0 : repForContact.phone) || '';
        const inheritedWhatsapp = (repForContact === null || repForContact === void 0 ? void 0 : repForContact.whatsapp) || (repForContact === null || repForContact === void 0 ? void 0 : repForContact.phone) || '';
        const inheritedPhone2 = (repForContact === null || repForContact === void 0 ? void 0 : repForContact.phone2) || '';
        const finalPhone1 = phone1 || inheritedPhone;
        const finalWhatsapp = whatsapp || inheritedWhatsapp;
        const finalPhone2 = phone2 || inheritedPhone2;
        if (finalPhone1 || email || address || finalWhatsapp || finalPhone2) {
            const contactPayload = {
                phone1: finalPhone1 || '',
                address: address || '',
                personId: person.id
            };
            if (finalPhone2)
                contactPayload.phone2 = finalPhone2;
            if (email)
                contactPayload.email = email;
            if (finalWhatsapp)
                contactPayload.whatsapp = finalWhatsapp;
            yield index_1.Contact.create(contactPayload, { transaction: t });
        }
        yield index_1.PersonResidence.create({
            personId: person.id,
            birthState,
            birthMunicipality,
            birthParish,
            residenceState,
            residenceMunicipality,
            residenceParish,
            address: address && address.trim().length > 0 ? address : undefined
        }, { transaction: t });
        if (Array.isArray(previousSchoolIds) && previousSchoolIds.length) {
            const schoolRecords = [];
            for (const item of previousSchoolIds) {
                const plantel = yield index_1.Plantel.findOne({
                    where: { [sequelize_1.Op.or]: [{ code: item }, { name: item }] },
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
                yield index_1.StudentPreviousSchool.bulkCreate(schoolRecords, { transaction: t });
            }
        }
        const assignments = [];
        if (motherData) {
            assignments.push({
                payload: (0, exports.mapToGuardianProfilePayload)(motherData),
                relationship: 'mother',
                isRepresentative: motherIsRepresentative
            });
        }
        if (fatherData) {
            assignments.push({
                payload: (0, exports.mapToGuardianProfilePayload)(fatherData),
                relationship: 'father',
                isRepresentative: fatherIsRepresentative
            });
        }
        if (representativeData) {
            const repRelationship = (representativeSelection === 'sibling' || representativeSelection === 'grandparent' || representativeSelection === 'uncle_aunt')
                ? representativeSelection
                : 'representative';
            assignments.push({
                payload: (0, exports.mapToGuardianProfilePayload)(representativeData),
                relationship: repRelationship,
                isRepresentative: true
            });
        }
        if (!assignments.some((guardian) => guardian.isRepresentative)) {
            throw new Error('Debe seleccionar al menos un representante legal.');
        }
        if (assignments.length > 0) {
            yield (0, studentGuardianService_1.assignGuardians)(person.id, assignments, t);
        }
        let role = yield index_1.Role.findOne({ where: { name: 'Alumno' }, transaction: t });
        if (!role) {
            role = yield index_1.Role.create({ name: 'Alumno' }, { transaction: t });
        }
        yield index_1.PersonRole.create({ personId: person.id, roleId: role.id }, { transaction: t });
        const matriculation = yield index_1.Matriculation.create({
            schoolPeriodId,
            gradeId,
            sectionId: sectionId || null,
            personId: person.id,
            status: 'pending',
            escolaridad: (0, exports.normalizeEscolaridad)(escolaridad)
        }, { transaction: t });
        if (Array.isArray(enrollmentAnswers)) {
            yield (0, enrollmentAnswerService_1.saveEnrollmentAnswers)(person.id, enrollmentAnswers, { transaction: t });
        }
        if (documents) {
            const documentPayload = {
                receivedCertificadoAprendizaje: Boolean(documents.receivedCertificadoAprendizaje),
                receivedCartaBuenaConducta: Boolean(documents.receivedCartaBuenaConducta),
                receivedNotasCertificadas: Boolean(documents.receivedNotasCertificadas),
                receivedPartidaNacimiento: Boolean(documents.receivedPartidaNacimiento),
                receivedCopiaCedulaEstudiante: Boolean(documents.receivedCopiaCedulaEstudiante),
                receivedInformesMedicos: Boolean(documents.receivedInformesMedicos),
                receivedFotoCarnetEstudiante: Boolean(documents.receivedFotoCarnetEstudiante),
                pathCedulaRepresentante: toOptionalString(documents.pathCedulaRepresentante),
                pathFotoRepresentante: toOptionalString(documents.pathFotoRepresentante),
                pathFotoEstudiante: toOptionalString(documents.pathFotoEstudiante),
                pathInformesMedicos: toOptionalStringArray(documents.pathInformesMedicos)
            };
            yield index_1.EnrollmentDocument.create(Object.assign({ matriculationId: matriculation.id }, documentPayload), { transaction: t });
        }
        const report = yield (0, enrollmentReportService_1.generateEnrollmentReport)(matriculation.id, t);
        if (!(options === null || options === void 0 ? void 0 : options.transaction)) {
            yield t.commit();
        }
        return { person, matriculation, reportUuid: report.uuid };
    }
    catch (error) {
        if (!(options === null || options === void 0 ? void 0 : options.transaction) && t) {
            yield t.rollback();
        }
        throw error;
    }
});
exports.registerAndEnrollStudent = registerAndEnrollStudent;
