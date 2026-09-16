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
exports.getReportByUuid = exports.getReportsByPerson = exports.generateEnrollmentReport = void 0;
const uuid_1 = require("uuid");
const EnrollmentReport_1 = __importDefault(require("../models/EnrollmentReport.js"));
const Matriculation_1 = __importDefault(require("../models/Matriculation.js"));
const Person_1 = __importDefault(require("../models/Person.js"));
const PersonResidence_1 = __importDefault(require("../models/PersonResidence.js"));
const Contact_1 = __importDefault(require("../models/Contact.js"));
const StudentGuardian_1 = __importDefault(require("../models/StudentGuardian.js"));
const GuardianProfile_1 = __importDefault(require("../models/GuardianProfile.js"));
const StudentPreviousSchool_1 = __importDefault(require("../models/StudentPreviousSchool.js"));
const EnrollmentAnswer_1 = __importDefault(require("../models/EnrollmentAnswer.js"));
const EnrollmentQuestion_1 = __importDefault(require("../models/EnrollmentQuestion.js"));
const EnrollmentDocument_1 = __importDefault(require("../models/EnrollmentDocument.js"));
const SchoolPeriod_1 = __importDefault(require("../models/SchoolPeriod.js"));
const Grade_1 = __importDefault(require("../models/Grade.js"));
const Setting_1 = __importDefault(require("../models/Setting.js"));
const getSettingValue = (key) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const setting = yield Setting_1.default.findOne({ where: { key } });
    return (_a = setting === null || setting === void 0 ? void 0 : setting.getDataValue('value')) !== null && _a !== void 0 ? _a : '';
});
const buildGuardianSnapshot = (profile) => ({
    firstName: profile.firstName,
    lastName: profile.lastName,
    documentType: profile.documentType,
    document: profile.document,
    phone: profile.phone,
    email: profile.email,
    residenceState: profile.residenceState,
    residenceMunicipality: profile.residenceMunicipality,
    residenceParish: profile.residenceParish,
    address: profile.address,
    occupation: profile.occupation || undefined,
    birthdate: profile.getDataValue('birthdate')
        ? String(profile.getDataValue('birthdate'))
        : null,
});
const generateEnrollmentReport = (matriculationId, transaction) => __awaiter(void 0, void 0, void 0, function* () {
    const matriculation = yield Matriculation_1.default.findByPk(matriculationId, {
        include: [
            { model: Person_1.default, as: 'student' },
            { model: SchoolPeriod_1.default, as: 'period' },
            { model: Grade_1.default, as: 'grade' },
        ],
        transaction,
    });
    if (!matriculation) {
        throw new Error('Matriculación no encontrada');
    }
    const person = matriculation.student;
    if (!person) {
        throw new Error('Estudiante no encontrado en la matriculación');
    }
    const [residence, contact, guardians, previousSchools, answers, enrollmentDoc, institutionName, institutionDeaCode] = yield Promise.all([
        PersonResidence_1.default.findOne({ where: { personId: person.id }, transaction }),
        Contact_1.default.findOne({ where: { personId: person.id }, transaction }),
        StudentGuardian_1.default.findAll({
            where: { studentId: person.id },
            include: [{ model: GuardianProfile_1.default, as: 'profile' }],
            transaction,
        }),
        StudentPreviousSchool_1.default.findAll({
            where: { personId: person.id },
            transaction,
        }),
        EnrollmentAnswer_1.default.findAll({
            where: { personId: person.id },
            include: [{ model: EnrollmentQuestion_1.default, as: 'question' }],
            transaction,
        }),
        EnrollmentDocument_1.default.findOne({
            where: { matriculationId },
            transaction,
        }),
        getSettingValue('institution_name'),
        getSettingValue('institution_dea_code'),
    ]);
    const period = matriculation.get('period');
    const grade = matriculation.get('grade');
    // Build guardian snapshots
    const motherGuardian = guardians.find((g) => g.relationship === 'mother');
    const fatherGuardian = guardians.find((g) => g.relationship === 'father');
    const representativeGuardian = guardians.find((g) => g.isRepresentative);
    let representativeSnapshot = null;
    if (representativeGuardian && representativeGuardian.profile) {
        representativeSnapshot = {
            relationship: representativeGuardian.relationship,
            data: buildGuardianSnapshot(representativeGuardian.profile),
        };
    }
    const snapshotData = {
        institution: {
            name: institutionName || 'Sin nombre configurado',
            deaCode: institutionDeaCode || '',
            logo: '/api/upload/logo',
        },
        period: { id: period.id, name: period.getDataValue('name') },
        grade: { id: grade.id, name: grade.getDataValue('name') },
        escolaridad: matriculation.escolaridad,
        student: {
            firstName: person.firstName,
            lastName: person.lastName,
            documentType: person.documentType,
            document: person.document,
            gender: person.gender,
            birthdate: person.birthdate ? String(person.birthdate) : null,
            pathology: person.pathology || undefined,
            livingWith: person.livingWith || undefined,
            birthState: residence === null || residence === void 0 ? void 0 : residence.birthState,
            birthMunicipality: residence === null || residence === void 0 ? void 0 : residence.birthMunicipality,
            birthParish: residence === null || residence === void 0 ? void 0 : residence.birthParish,
            residenceState: residence === null || residence === void 0 ? void 0 : residence.residenceState,
            residenceMunicipality: residence === null || residence === void 0 ? void 0 : residence.residenceMunicipality,
            residenceParish: residence === null || residence === void 0 ? void 0 : residence.residenceParish,
            phone1: (contact === null || contact === void 0 ? void 0 : contact.phone1) || undefined,
            phone2: (contact === null || contact === void 0 ? void 0 : contact.phone2) || undefined,
            email: (contact === null || contact === void 0 ? void 0 : contact.email) || undefined,
            address: (contact === null || contact === void 0 ? void 0 : contact.address) || undefined,
            whatsapp: (contact === null || contact === void 0 ? void 0 : contact.whatsapp) || undefined,
        },
        mother: (motherGuardian === null || motherGuardian === void 0 ? void 0 : motherGuardian.profile)
            ? buildGuardianSnapshot(motherGuardian.profile)
            : null,
        father: (fatherGuardian === null || fatherGuardian === void 0 ? void 0 : fatherGuardian.profile)
            ? buildGuardianSnapshot(fatherGuardian.profile)
            : null,
        representative: representativeSnapshot,
        previousSchools: previousSchools.map((s) => ({
            plantelName: s.plantelName,
            plantelCode: s.plantelCode,
            state: s.state,
        })),
        enrollmentAnswers: answers.map((a) => {
            var _a;
            const question = a.get('question');
            return {
                prompt: (_a = question === null || question === void 0 ? void 0 : question.getDataValue('prompt')) !== null && _a !== void 0 ? _a : 'Pregunta',
                answer: a.answer,
            };
        }),
        documents: enrollmentDoc
            ? {
                receivedCertificadoAprendizaje: enrollmentDoc.receivedCertificadoAprendizaje,
                receivedCartaBuenaConducta: enrollmentDoc.receivedCartaBuenaConducta,
                receivedNotasCertificadas: enrollmentDoc.receivedNotasCertificadas,
                receivedPartidaNacimiento: enrollmentDoc.receivedPartidaNacimiento,
                receivedCopiaCedulaEstudiante: enrollmentDoc.receivedCopiaCedulaEstudiante,
                receivedInformesMedicos: enrollmentDoc.receivedInformesMedicos,
                receivedFotoCarnetEstudiante: enrollmentDoc.receivedFotoCarnetEstudiante,
            }
            : null,
    };
    const report = yield EnrollmentReport_1.default.create({
        uuid: (0, uuid_1.v4)(),
        matriculationId,
        personId: person.id,
        snapshotData: snapshotData,
    }, { transaction });
    return report;
});
exports.generateEnrollmentReport = generateEnrollmentReport;
const getReportsByPerson = (personId) => __awaiter(void 0, void 0, void 0, function* () {
    return EnrollmentReport_1.default.findAll({
        where: { personId },
        order: [['createdAt', 'DESC']],
    });
});
exports.getReportsByPerson = getReportsByPerson;
const getReportByUuid = (uuid) => __awaiter(void 0, void 0, void 0, function* () {
    return EnrollmentReport_1.default.findOne({ where: { uuid } });
});
exports.getReportByUuid = getReportByUuid;
