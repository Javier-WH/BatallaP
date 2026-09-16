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
exports.findOrCreateGuardianProfile = exports.findGuardianProfile = void 0;
const GuardianProfile_1 = __importDefault(require("../models/GuardianProfile.js"));
const Person_1 = __importDefault(require("../models/Person.js"));
const Role_1 = __importDefault(require("../models/Role.js"));
const Contact_1 = __importDefault(require("../models/Contact.js"));
const PersonResidence_1 = __importDefault(require("../models/PersonResidence.js"));
const normalizeDocument = (document) => document.trim();
const findGuardianProfile = (documentType, document) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const normalizedDoc = normalizeDocument(document);
    // 1. Try to find in GuardianProfile table first
    const guardianProfile = yield GuardianProfile_1.default.findOne({
        where: {
            documentType,
            document: normalizedDoc
        }
    });
    if (guardianProfile) {
        return guardianProfile;
    }
    // 2. If not found, try to find in Person table
    const person = yield Person_1.default.findOne({
        where: {
            documentType,
            document: normalizedDoc
        },
        include: [
            {
                model: Role_1.default,
                as: 'roles',
                through: { attributes: [] } // Avoid including join table attributes
            },
            {
                model: Contact_1.default,
                as: 'contact'
            },
            {
                model: PersonResidence_1.default,
                as: 'residence'
            }
        ]
    });
    // If found in Person, map to GuardianProfile structure
    if (person) {
        // Check if person is a student
        const isStudent = (_a = person.roles) === null || _a === void 0 ? void 0 : _a.some(role => role.name === 'Alumno');
        // Allow if they are NOT a student, OR if they have other roles besides Student (e.g. Student + Representative?? Unlikely but possible in some systems)
        // Actually request said "excepto los estudiantes", imply pure students. 
        // If a person is both Student and Representative, they should probably be findable as Representative.
        // But usually a Student is a child. 
        // Let's stick to strict exclusion: If they have role 'Alumno', they might be the kid.
        // However, in adult education, a student can be a representative. 
        // User said: "todos los registros excepto los estudiantes".
        // Let's assume if they have the 'Alumno' role, they are a student and should be excluded unless they explicitly have another role like 'Representante'.
        // Simplest interpretation: Filter out if 'Alumno' is their ONLY role.
        const isStudentOnly = ((_b = person.roles) === null || _b === void 0 ? void 0 : _b.length) === 1 && person.roles[0].name === 'Alumno';
        // Or even stricter: if they have 'Alumno' role at all? 
        // "todos los registros excepto los estudiantes" usually means "don't return students".
        // Let's filter out if they have the Alumno role.
        // BUT, what if a teacher is also a student? 
        // Let's stick to the previous logic: exclude if ONLY student.
        if (!isStudentOnly) {
            return {
                id: person.id,
                firstName: person.firstName,
                lastName: person.lastName,
                documentType: person.documentType,
                document: person.document,
                phone: ((_c = person.contact) === null || _c === void 0 ? void 0 : _c.phone1) || ((_d = person.contact) === null || _d === void 0 ? void 0 : _d.phone2) || '',
                email: ((_e = person.contact) === null || _e === void 0 ? void 0 : _e.email) || '',
                residenceState: ((_f = person.residence) === null || _f === void 0 ? void 0 : _f.residenceState) || '',
                residenceMunicipality: ((_g = person.residence) === null || _g === void 0 ? void 0 : _g.residenceMunicipality) || '',
                residenceParish: ((_h = person.residence) === null || _h === void 0 ? void 0 : _h.residenceParish) || '',
                address: ((_j = person.contact) === null || _j === void 0 ? void 0 : _j.address) || ''
            };
        }
    }
    return null;
});
exports.findGuardianProfile = findGuardianProfile;
const findOrCreateGuardianProfile = (payload_1, ...args_1) => __awaiter(void 0, [payload_1, ...args_1], void 0, function* (payload, options = {}) {
    const normalizedDocument = normalizeDocument(payload.document);
    if (payload.id) {
        const existing = yield GuardianProfile_1.default.findByPk(payload.id, { transaction: options.transaction });
        if (existing) {
            yield existing.update(Object.assign(Object.assign({}, payload), { document: normalizedDocument }), options);
            return existing;
        }
        // If ID provided but not found, fall back to findOrCreate approach (maybe ID was wrong/deleted?)
    }
    const [profile, created] = yield GuardianProfile_1.default.findOrCreate(Object.assign({ where: {
            documentType: payload.documentType,
            document: normalizedDocument
        }, defaults: Object.assign(Object.assign({}, payload), { document: normalizedDocument }) }, options));
    if (!created) {
        yield profile.update(Object.assign(Object.assign({}, payload), { document: normalizedDocument }), options);
    }
    return profile;
});
exports.findOrCreateGuardianProfile = findOrCreateGuardianProfile;
