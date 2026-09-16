"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.createTestUser = createTestUser;
exports.createTestRole = createTestRole;
exports.createTestPeriod = createTestPeriod;
exports.createTestGrade = createTestGrade;
exports.createTestSection = createTestSection;
exports.createTestSubject = createTestSubject;
exports.createTestTerm = createTestTerm;
exports.createAcademicStructure = createAcademicStructure;
exports.createTestInscription = createTestInscription;
exports.createTestSetting = createTestSetting;
const index_1 = require("../../models/index.js");
// Monotonic counters to generate unique default values across calls
// within the same test (several columns have UNIQUE constraints).
let testUserCounter = 0;
let testStructureCounter = 0;
function createTestUser() {
    return __awaiter(this, arguments, void 0, function* (overrides = {}) {
        testUserCounter += 1;
        const suffix = testUserCounter.toString().padStart(6, '0');
        // Do NOT pre-hash the password: the User model has a beforeCreate hook
        // that hashes it. Pre-hashing here would cause a double hash and make
        // every login fail whenever `overrides` omits `password`.
        const user = yield index_1.User.create(Object.assign({ username: overrides.username || `testuser${suffix}`, password: overrides.password || 'password123' }, overrides));
        const person = yield index_1.Person.create({
            userId: user.id,
            firstName: overrides.firstName || 'Test',
            lastName: overrides.lastName || 'User',
            document: overrides.document || `${suffix}`,
            documentType: overrides.documentType || 'Venezolano',
            birthdate: overrides.birthdate || new Date('2000-01-01'),
            gender: overrides.gender || 'M'
        });
        return { user, person };
    });
}
function createTestRole(name) {
    return __awaiter(this, void 0, void 0, function* () {
        // Use findOrCreate to avoid unique constraint violations when the same role
        // is requested multiple times across different tests in the same suite.
        const [role] = yield index_1.Role.findOrCreate({ where: { name } });
        return role;
    });
}
function createTestPeriod() {
    return __awaiter(this, arguments, void 0, function* (overrides = {}) {
        testStructureCounter += 1;
        // Accepts either `status` or the legacy `isActive` flag
        let status = overrides.status;
        if (!status) {
            const active = overrides.isActive !== undefined ? overrides.isActive : true;
            status = active ? 'activo' : 'historico';
        }
        const idx = testStructureCounter;
        return yield index_1.SchoolPeriod.create({
            period: overrides.period || `2025-2026-${idx}`,
            name: overrides.name || `Año Escolar 2025-2026 #${idx}`,
            startYear: overrides.startYear || 2025,
            endYear: overrides.endYear || 2026,
            status
        });
    });
}
function createTestGrade() {
    return __awaiter(this, arguments, void 0, function* (overrides = {}) {
        testStructureCounter += 1;
        const idx = testStructureCounter;
        return yield index_1.Grade.create({
            name: overrides.name || `Primer año #${idx}`,
            isDiversified: overrides.isDiversified || false
        });
    });
}
function createTestSection() {
    return __awaiter(this, arguments, void 0, function* (overrides = {}) {
        testStructureCounter += 1;
        const idx = testStructureCounter;
        return yield index_1.Section.create({
            name: overrides.name || `Sección ${String.fromCharCode(65 + (idx % 26))}${Math.floor(idx / 26)}`
        });
    });
}
function createTestSubject() {
    return __awaiter(this, arguments, void 0, function* (overrides = {}) {
        testStructureCounter += 1;
        const idx = testStructureCounter;
        return yield index_1.Subject.create({
            name: overrides.name || `Matemática #${idx}`
        });
    });
}
function createTestTerm(periodId_1) {
    return __awaiter(this, arguments, void 0, function* (periodId, overrides = {}) {
        var _a;
        return yield index_1.Term.create({
            schoolPeriodId: periodId,
            name: overrides.name || 'Primer Lapso',
            order: overrides.order || 1,
            isBlocked: overrides.isBlocked || false,
            isActive: (_a = overrides.isActive) !== null && _a !== void 0 ? _a : false
        });
    });
}
function createAcademicStructure() {
    return __awaiter(this, arguments, void 0, function* (overrides = {}) {
        let period;
        if (overrides.periodId) {
            // Reuse an existing period instead of creating a duplicate
            const { SchoolPeriod } = yield Promise.resolve().then(() => __importStar(require('../../models/index.js')));
            period = yield SchoolPeriod.findByPk(overrides.periodId);
            if (!period)
                throw new Error(`Period ${overrides.periodId} not found`);
        }
        else {
            period = yield createTestPeriod(overrides.period || {});
        }
        const grade = yield createTestGrade();
        const section = yield createTestSection();
        const subject = yield createTestSubject();
        const periodGrade = yield index_1.PeriodGrade.create({
            schoolPeriodId: period.id,
            gradeId: grade.id
        });
        const periodGradeSection = yield index_1.PeriodGradeSection.create({
            periodGradeId: periodGrade.id,
            sectionId: section.id
        });
        const periodGradeSubject = yield index_1.PeriodGradeSubject.create({
            periodGradeId: periodGrade.id,
            subjectId: subject.id
        });
        return {
            period,
            grade,
            section,
            subject,
            periodGrade,
            periodGradeSection,
            periodGradeSubject
        };
    });
}
function createTestInscription(personId_1, periodId_1, gradeId_1, sectionId_1) {
    return __awaiter(this, arguments, void 0, function* (personId, periodId, gradeId, sectionId, overrides = {}) {
        return yield index_1.Inscription.create(Object.assign({ personId, schoolPeriodId: periodId, gradeId,
            sectionId, escolaridad: overrides.escolaridad || 'regular', isRepeater: overrides.isRepeater || false }, overrides));
    });
}
function createTestSetting(key, value) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield index_1.Setting.create({ key, value });
    });
}
