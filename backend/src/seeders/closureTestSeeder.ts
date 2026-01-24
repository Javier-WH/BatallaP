
import {
    SchoolPeriod,
    Grade,
    Section,
    Subject,
    Person,
    Role,
    PersonRole,
    Inscription,
    InscriptionSubject,
    Matriculation,
    PeriodGrade,
    PeriodGradeSubject,
    PeriodGradeSection,
    EvaluationPlan,
    Qualification
} from '../models';
import sequelize from '../config/database';

async function seedClosureTest() {
    const t = await sequelize.transaction();
    try {
        console.log('Starting Closure Test Seeder...');

        // 1. Ensure Roles
        let studentRole = await Role.findOne({ where: { name: 'Alumno' }, transaction: t });
        if (!studentRole) {
            studentRole = await Role.create({ name: 'Alumno' }, { transaction: t });
        }

        // 2. Get Active Period (2025-2026)
        const activePeriod = await SchoolPeriod.findOne({
            where: { isActive: true },
            transaction: t
        });

        if (!activePeriod) {
            throw new Error('No active period found. Please run basic seeds first.');
        }
        console.log(`Active Period: ${activePeriod.name}`);

        // 3. Get First Grade
        const firstGrade = await Grade.findOne({
            where: { name: 'Primer Año' },
            transaction: t
        });
        if (!firstGrade) throw new Error('Primer Año not found');

        // 4. Get Section A
        const sectionA = await Section.findOne({
            where: { name: 'Sección A' },
            transaction: t
        });
        if (!sectionA) throw new Error('Section A not found');

        // 5. Get PeriodGrade configuration
        const periodGrade = await PeriodGrade.findOne({
            where: {
                schoolPeriodId: activePeriod.id,
                gradeId: firstGrade.id
            },
            include: [
                {
                    model: Subject,
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
        await PeriodGradeSection.findOrCreate({
            where: {
                periodGradeId: periodGrade.id,
                sectionId: sectionA.id
            },
            transaction: t
        });

        // --- Student 1: Approved (All 20pts) ---
        const student1 = await Person.create({
            firstName: 'Test',
            lastName: 'Aprobado',
            documentType: 'Venezolano',
            document: '99000001',
            gender: 'M',
            birthdate: new Date('2010-01-01')
        }, { transaction: t });

        await PersonRole.create({ personId: student1.id, roleId: studentRole.id }, { transaction: t });

        const matriculation1 = await Matriculation.create({
            personId: student1.id,
            schoolPeriodId: activePeriod.id,
            gradeId: firstGrade.id,
            sectionId: sectionA.id,
            status: 'completed',
            escolaridad: 'regular'
        }, { transaction: t });

        const inscription1 = await Inscription.create({
            personId: student1.id,
            schoolPeriodId: activePeriod.id,
            gradeId: firstGrade.id,
            sectionId: sectionA.id,
            escolaridad: 'regular'
        }, { transaction: t });

        matriculation1.inscriptionId = inscription1.id;
        await matriculation1.save({ transaction: t });

        // --- Student 2: Pending Subjects (Fails 2 subjects) ---
        const student2 = await Person.create({
            firstName: 'Test',
            lastName: 'Pendiente',
            documentType: 'Venezolano',
            document: '99000002',
            gender: 'F',
            birthdate: new Date('2010-05-05')
        }, { transaction: t });

        await PersonRole.create({ personId: student2.id, roleId: studentRole.id }, { transaction: t });

        const matriculation2 = await Matriculation.create({
            personId: student2.id,
            schoolPeriodId: activePeriod.id,
            gradeId: firstGrade.id,
            sectionId: sectionA.id,
            status: 'completed',
            escolaridad: 'regular'
        }, { transaction: t });

        const inscription2 = await Inscription.create({
            personId: student2.id,
            schoolPeriodId: activePeriod.id,
            gradeId: firstGrade.id,
            sectionId: sectionA.id,
            escolaridad: 'regular'
        }, { transaction: t });

        matriculation2.inscriptionId = inscription2.id;
        await matriculation2.save({ transaction: t });

        // --- Enroll Subjects & Create Grades ---

        // We need PeriodGradeSubject IDs to link EvaluationPlans
        const pgsList = await PeriodGradeSubject.findAll({
            where: { periodGradeId: periodGrade.id },
            transaction: t
        });

        // Map subjectId -> PeriodGradeSubjectId
        const pgsMap = new Map();
        pgsList.forEach(pgs => pgsMap.set(pgs.subjectId, pgs.id));

        let subjectCount = 0;

        for (const subject of periodGrade.subjects) {
            subjectCount++;
            const pgsId = pgsMap.get(subject.id);

            // Enroll Student 1
            const is1 = await InscriptionSubject.create({
                inscriptionId: inscription1.id,
                subjectId: subject.id
            }, { transaction: t });

            // Enroll Student 2
            const is2 = await InscriptionSubject.create({
                inscriptionId: inscription2.id,
                subjectId: subject.id
            }, { transaction: t });

            // Create Evaluation Plan (100% weight single exam for simplicity)
            const plan = await EvaluationPlan.create({
                periodGradeSubjectId: pgsId,
                sectionId: sectionA.id,
                termId: 1, // Assuming Term 1 exists and is used
                // name: 'Examen Final Simulado',
                description: 'Nota única para prueba',
                objetivo: 'Objetivo General',
                percentage: 100,
                date: new Date()
            }, { transaction: t });

            // Grade Student 1: Always 20
            await Qualification.create({
                evaluationPlanId: plan.id,
                inscriptionSubjectId: is1.id,
                score: 20
            }, { transaction: t });

            // Grade Student 2: 
            // Fail first 2 subjects (09 pts), Pass rest (15 pts)
            const score2 = subjectCount <= 2 ? 9 : 15;

            await Qualification.create({
                evaluationPlanId: plan.id,
                inscriptionSubjectId: is2.id,
                score: score2
            }, { transaction: t });
        }

        await t.commit();
        console.log('Seeder completed successfully!');
        console.log('Student 1 (Approved): 99000001');
        console.log('Student 2 (Pending): 99000002');

    } catch (error) {
        await t.rollback();
        console.error('Seeder failed:', error);
    } finally {
        await sequelize.close();
    }
}

seedClosureTest();
