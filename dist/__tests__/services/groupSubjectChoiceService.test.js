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
const index_1 = require("../../models/index.js");
const groupSubjectChoiceService_1 = require("../../services/groupSubjectChoiceService.js");
const testData_1 = require("../helpers/testData");
describe('groupSubjectChoiceService', () => {
    it('aplica el cambio desde el lapso indicado y conserva las notas históricas', () => __awaiter(void 0, void 0, void 0, function* () {
        const period = yield (0, testData_1.createTestPeriod)();
        const term1 = yield (0, testData_1.createTestTerm)(period.id, { order: 1 });
        const term2 = yield (0, testData_1.createTestTerm)(period.id, { order: 2 });
        const structure = yield (0, testData_1.createAcademicStructure)({ periodId: period.id });
        const { person } = yield (0, testData_1.createTestUser)();
        const group = yield index_1.SubjectGroup.create({ name: `Grupo ${Date.now()}` });
        const oldSubject = yield index_1.Subject.create({ name: `Artes ${Date.now()}`, subjectGroupId: group.id });
        const newSubject = yield index_1.Subject.create({ name: `Desfile ${Date.now()}`, subjectGroupId: group.id });
        const inscription = yield index_1.Inscription.create({
            personId: person.id,
            schoolPeriodId: period.id,
            gradeId: structure.grade.id,
            sectionId: structure.section.id,
            escolaridad: 'regular',
        });
        const oldInscriptionSubject = yield index_1.InscriptionSubject.create({
            inscriptionId: inscription.id,
            subjectId: oldSubject.id,
            schoolPeriodId: period.id,
            gradeId: structure.grade.id,
            sectionId: structure.section.id,
        });
        yield index_1.InscriptionGroupTermChoice.create({
            inscriptionId: inscription.id,
            subjectGroupId: group.id,
            termId: term1.id,
            subjectId: oldSubject.id,
        });
        yield (0, groupSubjectChoiceService_1.changeGroupSubjectFromTerm)(inscription.id, group.id, newSubject.id, term2.id);
        const choices = yield index_1.InscriptionGroupTermChoice.findAll({
            where: { inscriptionId: inscription.id },
            order: [['termId', 'ASC']],
        });
        expect(choices.map(choice => [choice.termId, choice.subjectId])).toEqual([
            [term1.id, oldSubject.id],
            [term2.id, newSubject.id],
        ]);
        expect(yield index_1.InscriptionSubject.findOne({ where: { id: oldInscriptionSubject.id } })).not.toBeNull();
        expect(yield index_1.InscriptionSubject.findOne({ where: { inscriptionId: inscription.id, subjectId: newSubject.id } })).not.toBeNull();
        expect(term1.id).not.toBe(term2.id);
    }));
});
