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
const models_1 = require("../models");
const database_1 = __importDefault(require("../config/database"));
function seedClosureTest() {
    return __awaiter(this, void 0, void 0, function* () {
        const t = yield database_1.default.transaction();
        try {
            console.log('Starting Closure Test Seeder...');
            // 1. Ensure Roles
            let studentRole = yield models_1.Role.findOne({ where: { name: 'Alumno' }, transaction: t });
            if (!studentRole) {
                studentRole = yield models_1.Role.create({ name: 'Alumno' }, { transaction: t });
            }
            // 2. Get Active Period (2025-2026)
            const activePeriod = yield models_1.SchoolPeriod.findOne({
                where: { status: 'activo' },
                transaction: t
            });
            if (!activePeriod) {
                throw new Error('No active period found. Please run basic seeds first.');
            }
            console.log(`Active Period: ${activePeriod.name}`);
            // 3. Get First Grade
            const firstGrade = yield models_1.Grade.findOne({
                where: { name: 'Primer Año' },
                transaction: t
            });
            if (!firstGrade)
                throw new Error('Primer Año not found');
            // 4. Get Section A
            const sectionA = yield models_1.Section.findOne({
                where: { name: 'Sección A' },
                transaction: t
            });
            if (!sectionA)
                throw new Error('Section A not found');
            // 5. Get PeriodGrade configuration
            const periodGrade = yield models_1.PeriodGrade.findOne({
                where: {
                    schoolPeriodId: activePeriod.id,
                    gradeId: firstGrade.id
                },
                include: [
                    {
                        model: models_1.Subject,
                        as: 'subjects',
                        through: { attributes: ['id'] } // Get PeriodGradeSubject ID
                    }
                ],
                transaction: t
            });
            if (!periodGrade || !periodGrade.subjects || periodGrade.subjects.length === 0) {
                throw new Error('PeriodGrade configuration for First Year not found or empty');
            }
            // Ensure Section is assigned to PeriodGrade
            yield models_1.PeriodGradeSection.findOrCreate({
                where: {
                    periodGradeId: periodGrade.id,
                    sectionId: sectionA.id
                },
                transaction: t
            });
            // --- Student 1: Approved (All 20pts) ---
            const student1 = yield models_1.Person.create({
                firstName: 'Test',
                lastName: 'Aprobado',
                documentType: 'Venezolano',
                document: '99000001',
                gender: 'M',
                birthdate: new Date('2010-01-01')
            }, { transaction: t });
            yield models_1.PersonRole.create({ personId: student1.id, roleId: studentRole.id }, { transaction: t });
            const matriculation1 = yield models_1.Matriculation.create({
                personId: student1.id,
                schoolPeriodId: activePeriod.id,
                gradeId: firstGrade.id,
                sectionId: sectionA.id,
                status: 'completed',
                escolaridad: 'regular'
            }, { transaction: t });
            const inscription1 = yield models_1.Inscription.create({
                personId: student1.id,
                schoolPeriodId: activePeriod.id,
                gradeId: firstGrade.id,
                sectionId: sectionA.id,
                escolaridad: 'regular'
            }, { transaction: t });
            matriculation1.inscriptionId = inscription1.id;
            yield matriculation1.save({ transaction: t });
            // --- Student 2: Pending Subjects (Fails 2 subjects) ---
            const student2 = yield models_1.Person.create({
                firstName: 'Test',
                lastName: 'Pendiente',
                documentType: 'Venezolano',
                document: '99000002',
                gender: 'F',
                birthdate: new Date('2010-05-05')
            }, { transaction: t });
            yield models_1.PersonRole.create({ personId: student2.id, roleId: studentRole.id }, { transaction: t });
            const matriculation2 = yield models_1.Matriculation.create({
                personId: student2.id,
                schoolPeriodId: activePeriod.id,
                gradeId: firstGrade.id,
                sectionId: sectionA.id,
                status: 'completed',
                escolaridad: 'regular'
            }, { transaction: t });
            const inscription2 = yield models_1.Inscription.create({
                personId: student2.id,
                schoolPeriodId: activePeriod.id,
                gradeId: firstGrade.id,
                sectionId: sectionA.id,
                escolaridad: 'regular'
            }, { transaction: t });
            matriculation2.inscriptionId = inscription2.id;
            yield matriculation2.save({ transaction: t });
            // --- Enroll Subjects & Create Grades ---
            // Get All Terms for period
            const terms = yield database_1.default.models.Term.findAll({
                where: { schoolPeriodId: activePeriod.id },
                order: [['order', 'ASC']],
                transaction: t
            });
            if (terms.length === 0)
                throw new Error('No terms found for active period');
            // We need PeriodGradeSubject IDs to link EvaluationPlans
            const pgsList = yield models_1.PeriodGradeSubject.findAll({
                where: { periodGradeId: periodGrade.id },
                transaction: t
            });
            // Map subjectId -> PeriodGradeSubjectId
            const pgsMap = new Map();
            pgsList.forEach((pgs) => pgsMap.set(pgs.subjectId, pgs.id));
            let subjectCount = 0;
            for (const subject of periodGrade.subjects) {
                subjectCount++;
                const pgsId = pgsMap.get(subject.id);
                // Enroll Student 1
                const is1 = yield models_1.InscriptionSubject.create({
                    inscriptionId: inscription1.id,
                    subjectId: subject.id
                }, { transaction: t });
                // Enroll Student 2
                const is2 = yield models_1.InscriptionSubject.create({
                    inscriptionId: inscription2.id,
                    subjectId: subject.id
                }, { transaction: t });
                // Create Grades for EACH Term
                for (const term of terms) {
                    const termId = term.id;
                    // Clean up existing plans for this subject/term
                    yield models_1.EvaluationPlan.destroy({
                        where: {
                            periodGradeSubjectId: pgsId,
                            sectionId: sectionA.id,
                            termId: termId
                        },
                        transaction: t
                    });
                    // Create Evaluation Plan (100% weight single exam per term)
                    const plan = yield models_1.EvaluationPlan.create({
                        periodGradeSubjectId: pgsId,
                        sectionId: sectionA.id,
                        termId: termId,
                        description: `Nota única Lapso ${termId}`,
                        percentage: 100,
                        date: new Date()
                    }, { transaction: t });
                    // Grade Student 1: Always 20
                    yield models_1.Qualification.create({
                        evaluationPlanId: plan.id,
                        inscriptionSubjectId: is1.id,
                        score: 20
                    }, { transaction: t });
                    // Grade Student 2: 
                    // Fail first 2 subjects (09 pts), Pass rest (15 pts)
                    const score2 = subjectCount <= 2 ? 9 : 15;
                    yield models_1.Qualification.create({
                        evaluationPlanId: plan.id,
                        inscriptionSubjectId: is2.id,
                        score: score2
                    }, { transaction: t });
                }
            }
            yield t.commit();
            console.log('Seeder completed successfully!');
            console.log('Student 1 (Approved): 99000001');
            console.log('Student 2 (Pending): 99000002');
        }
        catch (error) {
            yield t.rollback();
            console.error('Seeder failed:', error);
        }
        finally {
            yield database_1.default.close();
        }
    });
}
seedClosureTest();
