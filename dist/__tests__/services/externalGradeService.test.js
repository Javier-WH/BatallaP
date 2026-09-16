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
const externalGradeService_1 = require("../../services/externalGradeService.js");
const index_1 = require("../../models/index.js");
const testData_1 = require("../helpers/testData");
describe('externalGradeService', () => {
    describe('resolveOrCreatePlantel', () => {
        it('retorna plantel existente por code', () => __awaiter(void 0, void 0, void 0, function* () {
            const existing = yield index_1.Plantel.create({
                code: 'EXT001',
                name: 'Colegio Test',
                state: 'Guárico',
            });
            const result = yield (0, externalGradeService_1.resolveOrCreatePlantel)({
                code: 'EXT001',
                name: 'Colegio Test Updated',
                state: 'Guárico',
            });
            expect(result.id).toBe(existing.id);
            expect(result.name).toBe('COLEGIO TEST UPDATED'); // hook mayusculiza
        }));
        it('retorna plantel por name+state cuando no hay code', () => __awaiter(void 0, void 0, void 0, function* () {
            const existing = yield index_1.Plantel.create({
                code: 'EXT002',
                name: 'Liceo Test',
                state: 'Miranda',
            });
            // Plantel hook mayusculiza name/state, so search with uppercase
            const result = yield (0, externalGradeService_1.resolveOrCreatePlantel)({
                name: 'LICEO TEST',
                state: 'MIRANDA',
            });
            expect(result.id).toBe(existing.id);
        }));
        it('crea plantel nuevo si no existe', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield (0, externalGradeService_1.resolveOrCreatePlantel)({
                code: 'EXT003',
                name: 'Nuevo Colegio',
                state: 'Aragua',
            });
            expect(result).toBeDefined();
            expect(result.code).toBe('EXT003');
            expect(result.name).toBe('NUEVO COLEGIO');
        }));
        it('genera code automático si no se provee', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield (0, externalGradeService_1.resolveOrCreatePlantel)({
                name: 'Sin Code',
                state: 'Carabobo',
            });
            expect(result.code).toMatch(/^EXT-\d+$/);
        }));
    });
    describe('resolveOrCreateExternalPeriod', () => {
        it('retorna período existente', () => __awaiter(void 0, void 0, void 0, function* () {
            const existing = yield index_1.SchoolPeriod.create({
                period: '2023-2024',
                name: 'Período Externo',
                startYear: 2023,
                endYear: 2024,
                status: 'externo',
            });
            const result = yield (0, externalGradeService_1.resolveOrCreateExternalPeriod)('2023-2024', 'Período Externo', 2023, 2024);
            expect(result.id).toBe(existing.id);
        }));
        it('crea período externo nuevo', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield (0, externalGradeService_1.resolveOrCreateExternalPeriod)('2022-2023', 'Período 22-23', 2022, 2023);
            expect(result).toBeDefined();
            expect(result.status).toBe('externo');
            expect(result.period).toBe('2022-2023');
        }));
    });
    describe('createExternalInscription', () => {
        it('valida person/grade/plantel existentes', () => __awaiter(void 0, void 0, void 0, function* () {
            const { person } = yield (0, testData_1.createTestUser)({ username: 'ext1' });
            const grade = yield (0, testData_1.createTestGrade)();
            const plantel = yield index_1.Plantel.create({ code: 'EXT100', name: 'Plantel Ext', state: 'Guárico' });
            const inscription = yield (0, externalGradeService_1.createExternalInscription)({
                personId: person.id,
                periodLabel: '2020-2021',
                periodName: 'Externo 2020',
                gradeId: grade.id,
                plantelId: plantel.id,
            });
            expect(inscription).toBeDefined();
            expect(inscription.escolaridad).toBe('transferencia');
        }));
        it('reusa inscripción existente para mismo person+period', () => __awaiter(void 0, void 0, void 0, function* () {
            const { person } = yield (0, testData_1.createTestUser)({ username: 'ext2' });
            const grade = yield (0, testData_1.createTestGrade)();
            const plantel = yield index_1.Plantel.create({ code: 'EXT101', name: 'Plantel Ext2', state: 'Guárico' });
            const ins1 = yield (0, externalGradeService_1.createExternalInscription)({
                personId: person.id,
                periodLabel: '2021-2022',
                periodName: 'Externo 2021',
                gradeId: grade.id,
                plantelId: plantel.id,
            });
            const ins2 = yield (0, externalGradeService_1.createExternalInscription)({
                personId: person.id,
                periodLabel: '2021-2022',
                periodName: 'Externo 2021',
                gradeId: grade.id,
                plantelId: plantel.id,
            });
            expect(ins1.id).toBe(ins2.id);
        }));
        it('falla si la persona no existe', () => __awaiter(void 0, void 0, void 0, function* () {
            const grade = yield (0, testData_1.createTestGrade)();
            const plantel = yield index_1.Plantel.create({ code: 'EXT102', name: 'Plantel Ext3', state: 'Guárico' });
            yield expect((0, externalGradeService_1.createExternalInscription)({
                personId: 99999,
                periodLabel: '2020-2021',
                periodName: 'Externo',
                gradeId: grade.id,
                plantelId: plantel.id,
            })).rejects.toThrow('Estudiante no encontrado');
        }));
    });
    describe('upsertExternalGrade', () => {
        it('crea SubjectFinalGrade con gradeType=transferencia', () => __awaiter(void 0, void 0, void 0, function* () {
            const { person } = yield (0, testData_1.createTestUser)({ username: 'ext3' });
            const grade = yield (0, testData_1.createTestGrade)();
            const subject = yield (0, testData_1.createTestSubject)();
            const plantel = yield index_1.Plantel.create({ code: 'EXT200', name: 'Plantel', state: 'Guárico' });
            const inscription = yield (0, externalGradeService_1.createExternalInscription)({
                personId: person.id,
                periodLabel: '2019-2020',
                periodName: 'Externo 2019',
                gradeId: grade.id,
                plantelId: plantel.id,
            });
            const result = yield (0, externalGradeService_1.upsertExternalGrade)({
                inscriptionId: inscription.id,
                subjectId: subject.id,
                finalScore: 15,
                status: 'aprobada',
                plantelId: plantel.id,
                issuedAt: new Date('2020-07-15'),
                gradeType: 'transferencia',
            });
            expect(result).toBeDefined();
            expect(result.finalScore).toBe(15);
            expect(result.gradeType).toBe('transferencia');
            expect(result.status).toBe('aprobada');
        }));
        it('actualiza SubjectFinalGrade existente', () => __awaiter(void 0, void 0, void 0, function* () {
            const { person } = yield (0, testData_1.createTestUser)({ username: 'ext4' });
            const grade = yield (0, testData_1.createTestGrade)();
            const subject = yield (0, testData_1.createTestSubject)();
            const plantel = yield index_1.Plantel.create({ code: 'EXT201', name: 'Plantel', state: 'Guárico' });
            const inscription = yield (0, externalGradeService_1.createExternalInscription)({
                personId: person.id,
                periodLabel: '2018-2019',
                periodName: 'Externo 2018',
                gradeId: grade.id,
                plantelId: plantel.id,
            });
            yield (0, externalGradeService_1.upsertExternalGrade)({
                inscriptionId: inscription.id,
                subjectId: subject.id,
                finalScore: 10,
                status: 'aprobada',
                plantelId: plantel.id,
                issuedAt: new Date('2019-07-15'),
                gradeType: 'transferencia',
            });
            const updated = yield (0, externalGradeService_1.upsertExternalGrade)({
                inscriptionId: inscription.id,
                subjectId: subject.id,
                finalScore: 18,
                status: 'aprobada',
                plantelId: plantel.id,
                issuedAt: new Date('2019-07-15'),
                gradeType: 'transferencia',
            });
            expect(updated.finalScore).toBe(18);
            const count = yield index_1.SubjectFinalGrade.count({
                where: { inscriptionSubjectId: updated.inscriptionSubjectId, gradeType: 'transferencia' },
            });
            expect(count).toBe(1);
        }));
        it('rechaza inscripción que no es transferencia', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const { person } = yield (0, testData_1.createTestUser)({ username: 'ext5' });
            const inscription = yield index_1.Inscription.create({
                personId: person.id,
                schoolPeriodId: structure.period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
                escolaridad: 'regular',
                isRepeater: false,
            });
            yield expect((0, externalGradeService_1.upsertExternalGrade)({
                inscriptionId: inscription.id,
                subjectId: structure.subject.id,
                finalScore: 15,
                status: 'aprobada',
                plantelId: 1,
                issuedAt: new Date(),
                gradeType: 'transferencia',
            })).rejects.toThrow('no es de tipo transferencia');
        }));
        it('audita con logGradeChange cuando editedBy se provee', () => __awaiter(void 0, void 0, void 0, function* () {
            const { person, user } = yield (0, testData_1.createTestUser)({ username: 'ext6' });
            const grade = yield (0, testData_1.createTestGrade)();
            const subject = yield (0, testData_1.createTestSubject)();
            const plantel = yield index_1.Plantel.create({ code: 'EXT202', name: 'Plantel', state: 'Guárico' });
            const inscription = yield (0, externalGradeService_1.createExternalInscription)({
                personId: person.id,
                periodLabel: '2017-2018',
                periodName: 'Externo 2017',
                gradeId: grade.id,
                plantelId: plantel.id,
            });
            yield (0, externalGradeService_1.upsertExternalGrade)({
                inscriptionId: inscription.id,
                subjectId: subject.id,
                finalScore: 15,
                status: 'aprobada',
                plantelId: plantel.id,
                issuedAt: new Date('2018-07-15'),
                gradeType: 'transferencia',
                editedBy: user.id,
            });
            const logs = yield index_1.GradeChangeLog.count({
                where: { editedBy: user.id },
            });
            expect(logs).toBeGreaterThanOrEqual(1);
        }));
    });
    describe('listExternalGradesForPerson', () => {
        it('retorna inscripciones externas con sus notas', () => __awaiter(void 0, void 0, void 0, function* () {
            const { person } = yield (0, testData_1.createTestUser)({ username: 'ext7' });
            const grade = yield (0, testData_1.createTestGrade)();
            const subject = yield (0, testData_1.createTestSubject)();
            const plantel = yield index_1.Plantel.create({ code: 'EXT300', name: 'Plantel', state: 'Guárico' });
            const inscription = yield (0, externalGradeService_1.createExternalInscription)({
                personId: person.id,
                periodLabel: '2016-2017',
                periodName: 'Externo 2016',
                gradeId: grade.id,
                plantelId: plantel.id,
            });
            yield (0, externalGradeService_1.upsertExternalGrade)({
                inscriptionId: inscription.id,
                subjectId: subject.id,
                finalScore: 14,
                status: 'aprobada',
                plantelId: plantel.id,
                issuedAt: new Date('2017-07-15'),
                gradeType: 'transferencia',
            });
            const result = yield (0, externalGradeService_1.listExternalGradesForPerson)(person.id);
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe(inscription.id);
        }));
        it('retorna vacío para persona sin inscripciones externas', () => __awaiter(void 0, void 0, void 0, function* () {
            const { person } = yield (0, testData_1.createTestUser)({ username: 'ext8' });
            const result = yield (0, externalGradeService_1.listExternalGradesForPerson)(person.id);
            expect(result).toEqual([]);
        }));
    });
    describe('deleteExternalGrade', () => {
        it('elimina grade externa', () => __awaiter(void 0, void 0, void 0, function* () {
            const { person } = yield (0, testData_1.createTestUser)({ username: 'ext9' });
            const grade = yield (0, testData_1.createTestGrade)();
            const subject = yield (0, testData_1.createTestSubject)();
            const plantel = yield index_1.Plantel.create({ code: 'EXT400', name: 'Plantel', state: 'Guárico' });
            const inscription = yield (0, externalGradeService_1.createExternalInscription)({
                personId: person.id,
                periodLabel: '2015-2016',
                periodName: 'Externo 2015',
                gradeId: grade.id,
                plantelId: plantel.id,
            });
            const fg = yield (0, externalGradeService_1.upsertExternalGrade)({
                inscriptionId: inscription.id,
                subjectId: subject.id,
                finalScore: 12,
                status: 'aprobada',
                plantelId: plantel.id,
                issuedAt: new Date('2016-07-15'),
                gradeType: 'transferencia',
            });
            yield (0, externalGradeService_1.deleteExternalGrade)(fg.id);
            const count = yield index_1.SubjectFinalGrade.count({ where: { id: fg.id } });
            expect(count).toBe(0);
        }));
        it('rechaza grade no-externa', () => __awaiter(void 0, void 0, void 0, function* () {
            const structure = yield (0, testData_1.createAcademicStructure)();
            const { person } = yield (0, testData_1.createTestUser)({ username: 'ext10' });
            const inscription = yield index_1.Inscription.create({
                personId: person.id,
                schoolPeriodId: structure.period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
                escolaridad: 'regular',
                isRepeater: false,
            });
            const insSub = yield index_1.InscriptionSubject.create({
                inscriptionId: inscription.id,
                subjectId: structure.subject.id,
                schoolPeriodId: structure.period.id,
                gradeId: structure.grade.id,
                sectionId: structure.section.id,
            });
            const fg = yield index_1.SubjectFinalGrade.create({
                inscriptionSubjectId: insSub.id,
                finalScore: 14,
                status: 'aprobada',
                gradeType: 'regular',
                calculatedAt: new Date(),
                schoolPeriodId: structure.period.id,
                subjectId: structure.subject.id,
                gradeId: structure.grade.id,
            });
            yield expect((0, externalGradeService_1.deleteExternalGrade)(fg.id)).rejects.toThrow('Solo se pueden eliminar notas externas');
        }));
        it('falla si la grade no existe', () => __awaiter(void 0, void 0, void 0, function* () {
            yield expect((0, externalGradeService_1.deleteExternalGrade)(99999)).rejects.toThrow('Nota no encontrada');
        }));
    });
    describe('registerExternalGradesBatch', () => {
        it('orchestra registro masivo en transacción', () => __awaiter(void 0, void 0, void 0, function* () {
            const { person } = yield (0, testData_1.createTestUser)({ username: 'ext11' });
            const grade = yield (0, testData_1.createTestGrade)();
            const subject1 = yield (0, testData_1.createTestSubject)();
            const subject2 = yield (0, testData_1.createTestSubject)();
            const result = yield (0, externalGradeService_1.registerExternalGradesBatch)([
                {
                    personId: person.id,
                    periodLabel: '2014-2015',
                    periodName: 'Externo 2014',
                    gradeId: grade.id,
                    plantel: { code: 'EXT500', name: 'Plantel Batch', state: 'Guárico' },
                    grades: [
                        { subjectId: subject1.id, finalScore: 15, status: 'aprobada', issuedAt: new Date('2015-07-15'), gradeType: 'transferencia' },
                        { subjectId: subject2.id, finalScore: 8, status: 'reprobada', issuedAt: new Date('2015-07-15'), gradeType: 'transferencia' },
                    ],
                },
            ]);
            expect(result.created).toBe(2);
            expect(result.skipped).toBe(0);
        }));
        it('cuenta skipped cuando hay errores', () => __awaiter(void 0, void 0, void 0, function* () {
            const { person } = yield (0, testData_1.createTestUser)({ username: 'ext12' });
            const grade = yield (0, testData_1.createTestGrade)();
            const result = yield (0, externalGradeService_1.registerExternalGradesBatch)([
                {
                    personId: person.id,
                    periodLabel: '2013-2014',
                    periodName: 'Externo 2013',
                    gradeId: grade.id,
                    plantel: { code: 'EXT501', name: 'Plantel Batch2', state: 'Guárico' },
                    grades: [
                        // subjectId inválido → error
                        { subjectId: 99999, finalScore: 15, status: 'aprobada', issuedAt: new Date('2014-07-15'), gradeType: 'transferencia' },
                    ],
                },
            ]);
            expect(result.created).toBe(0);
            expect(result.skipped).toBe(1);
        }));
    });
});
