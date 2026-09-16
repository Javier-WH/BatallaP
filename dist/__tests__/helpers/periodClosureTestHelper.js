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
exports.createFullClosureSetup = createFullClosureSetup;
exports.createStudentWithGrades = createStudentWithGrades;
exports.createPendingSubjectForStudent = createPendingSubjectForStudent;
exports.markCouncilsDone = markCouncilsDone;
exports.createCompletedRevisionPeriod = createCompletedRevisionPeriod;
exports.executeClosure = executeClosure;
exports.validateClosure = validateClosure;
exports.createSeparateMPInscription = createSeparateMPInscription;
exports.createRevisionGrade = createRevisionGrade;
exports.removeRegularFinalGrade = removeRegularFinalGrade;
const index_1 = require("../../models/index.js");
const periodClosureExecutor_1 = require("../../services/periodClosureExecutor.js");
let helperCounter = 0;
function nextId() {
    helperCounter += 1;
    return helperCounter.toString().padStart(6, '0');
}
/**
 * Creates a full closure setup with:
 * - A current period (activo) and a next period (preinscripcion)
 * - N grades with `order` 1..N
 * - One section per grade in each period
 * - M subjects per grade in each period
 * - 3 blocked terms
 * - Settings: min_approval_grade=10, max_failed_subjects=3
 * - Transition rules: grade[i] -> grade[i+1], last grade has no gradeToId
 * - A master user to execute the closure
 */
function createFullClosureSetup() {
    return __awaiter(this, arguments, void 0, function* (options = {}) {
        var _a, _b, _c, _d, _e, _f;
        const gradeCount = (_a = options.gradeCount) !== null && _a !== void 0 ? _a : 2;
        const subjectsPerGrade = (_b = options.subjectsPerGrade) !== null && _b !== void 0 ? _b : 3;
        const suffix = nextId();
        // Master user
        const masterUser = yield index_1.User.create({
            username: `master_${suffix}`,
            password: 'password123',
        });
        const masterPerson = yield index_1.Person.create({
            userId: masterUser.id,
            firstName: 'Master',
            lastName: 'Test',
            document: `M${suffix}`,
            documentType: 'Venezolano',
            birthdate: new Date('1990-01-01'),
            gender: 'M',
        });
        const [masterRole] = yield index_1.Role.findOrCreate({ where: { name: 'Master' } });
        yield index_1.PersonRole.create({ personId: masterPerson.id, roleId: masterRole.id });
        // Periods
        const currentPeriod = yield index_1.SchoolPeriod.create({
            period: `2025-2026-${suffix}`,
            name: `Año Escolar 2025-2026 #${suffix}`,
            startYear: 2025,
            endYear: 2026,
            status: 'activo',
        });
        const nextPeriod = yield index_1.SchoolPeriod.create({
            period: `2026-2027-${suffix}`,
            name: `Año Escolar 2026-2027 #${suffix}`,
            startYear: 2026,
            endYear: 2027,
            status: 'preinscripcion',
        });
        // Grades
        const grades = [];
        const gradeNames = (_c = options.gradeNames) !== null && _c !== void 0 ? _c : ['1ER AÑO', '2DO AÑO', '3ER AÑO', '4TO AÑO', '5TO AÑO'];
        for (let i = 0; i < gradeCount; i++) {
            const g = yield index_1.Grade.create({
                name: `${(_d = gradeNames[i]) !== null && _d !== void 0 ? _d : `GRADO ${i + 1}`} ${suffix}`,
                isDiversified: false,
                order: i + 1,
            });
            grades.push(g);
        }
        // Sections (one per grade, shared across periods)
        const sections = [];
        for (let i = 0; i < gradeCount; i++) {
            const s = yield index_1.Section.create({ name: `A-${suffix}-${i}` });
            sections.push(s);
        }
        // Subjects (shared across grades for simplicity)
        const subjects = [];
        const subjectNames = (_e = options.subjectNames) !== null && _e !== void 0 ? _e : ['MATEMÁTICA', 'CIENCIAS', 'HISTORIA', 'LENGUA', 'GEOGRAFÍA'];
        for (let i = 0; i < subjectsPerGrade; i++) {
            const s = yield index_1.Subject.create({ name: `${(_f = subjectNames[i]) !== null && _f !== void 0 ? _f : `MATERIA ${i + 1}`} ${suffix}` });
            subjects.push(s);
        }
        // Terms (3, all blocked)
        const terms = [];
        for (let i = 0; i < 3; i++) {
            const t = yield index_1.Term.create({
                schoolPeriodId: currentPeriod.id,
                name: `Lapso ${i + 1}`,
                order: i + 1,
                isBlocked: true,
                isActive: false,
            });
            terms.push(t);
        }
        // PeriodGrades + PeriodGradeSections + PeriodGradeSubjects for current and next period
        const periodGradesCurrent = new Map();
        const periodGradesNext = new Map();
        const periodGradeSubjectsCurrent = new Map();
        const periodGradeSubjectsNext = new Map();
        for (let gi = 0; gi < gradeCount; gi++) {
            const grade = grades[gi];
            const section = sections[gi];
            // Current period
            const pgCurrent = yield index_1.PeriodGrade.create({
                schoolPeriodId: currentPeriod.id,
                gradeId: grade.id,
            });
            periodGradesCurrent.set(grade.id, pgCurrent);
            yield index_1.PeriodGradeSection.create({
                periodGradeId: pgCurrent.id,
                sectionId: section.id,
            });
            for (let si = 0; si < subjectsPerGrade; si++) {
                const pgs = yield index_1.PeriodGradeSubject.create({
                    periodGradeId: pgCurrent.id,
                    subjectId: subjects[si].id,
                    active: true,
                    includeInAverage: true,
                    weeklyBlocks: 2,
                });
                periodGradeSubjectsCurrent.set(`${grade.id}:${subjects[si].id}`, pgs);
            }
            // Next period (skipped when nextPeriodStructure === 'none')
            if (options.nextPeriodStructure !== 'none') {
                const pgNext = yield index_1.PeriodGrade.create({
                    schoolPeriodId: nextPeriod.id,
                    gradeId: grade.id,
                });
                periodGradesNext.set(grade.id, pgNext);
                yield index_1.PeriodGradeSection.create({
                    periodGradeId: pgNext.id,
                    sectionId: section.id,
                });
                for (let si = 0; si < subjectsPerGrade; si++) {
                    const pgs = yield index_1.PeriodGradeSubject.create({
                        periodGradeId: pgNext.id,
                        subjectId: subjects[si].id,
                        active: true,
                        includeInAverage: true,
                        weeklyBlocks: 2,
                    });
                    periodGradeSubjectsNext.set(`${grade.id}:${subjects[si].id}`, pgs);
                }
            }
        }
        // Transition rules: grade[i] -> grade[i+1], last grade has no gradeToId
        const transitionRules = new Map();
        for (let i = 0; i < gradeCount; i++) {
            const rule = yield index_1.SchoolPeriodTransitionRule.create({
                gradeFromId: grades[i].id,
                gradeToId: i < gradeCount - 1 ? grades[i + 1].id : null,
                minAverage: 10,
                maxPendingSubjects: 3,
                autoGraduate: i === gradeCount - 1, // auto-graduate on last grade
            });
            transitionRules.set(grades[i].id, rule);
        }
        // Settings
        yield index_1.Setting.create({ key: 'min_approval_grade', value: '10' });
        yield index_1.Setting.create({ key: 'max_failed_subjects', value: '3' });
        return {
            currentPeriod,
            nextPeriod,
            grades,
            sections,
            subjects,
            terms,
            periodGradesCurrent,
            periodGradesNext,
            periodGradeSubjectsCurrent,
            periodGradeSubjectsNext,
            transitionRules,
            masterUser,
            masterPerson,
        };
    });
}
/**
 * Creates a student with an inscription in the current period and
 * InscriptionSubject + SubjectFinalGrade for each subject with the given scores.
 *
 * @param setup The closure setup
 * @param gradeIndex Index of the grade (0-based)
 * @param scores Map of subjectIndex -> finalScore (e.g. {0: 15, 1: 8, 2: 12})
 * @param options.escolaridad Escolaridad status (default 'regular')
 * @param options.originPeriodId For materia_pendiente inscriptions
 */
function createStudentWithGrades(setup_1, gradeIndex_1, scores_1) {
    return __awaiter(this, arguments, void 0, function* (setup, gradeIndex, scores, options = {}) {
        var _a, _b;
        const suffix = nextId();
        const grade = setup.grades[gradeIndex];
        const section = setup.sections[gradeIndex];
        // Create student person
        const person = yield index_1.Person.create({
            firstName: `Estudiante`,
            lastName: `Test ${suffix}`,
            document: `E${suffix}`,
            documentType: 'Venezolano',
            birthdate: new Date('2010-01-01'),
            gender: 'M',
        });
        // Create inscription
        const inscription = yield index_1.Inscription.create({
            personId: person.id,
            schoolPeriodId: setup.currentPeriod.id,
            gradeId: grade.id,
            sectionId: section.id,
            escolaridad: options.escolaridad || 'regular',
            isRepeater: options.escolaridad === 'repitiente',
        });
        // Create InscriptionSubject + SubjectFinalGrade for each subject
        const inscriptionSubjects = new Map();
        for (let si = 0; si < setup.subjects.length; si++) {
            const subject = setup.subjects[si];
            const insSub = yield index_1.InscriptionSubject.create({
                inscriptionId: inscription.id,
                subjectId: subject.id,
                schoolPeriodId: setup.currentPeriod.id,
                gradeId: grade.id,
                sectionId: section.id,
            });
            inscriptionSubjects.set(subject.id, insSub);
            // Create SubjectTermGrade for each term (score 0, will be overwritten by sync)
            for (const term of setup.terms) {
                yield index_1.SubjectTermGrade.create({
                    inscriptionSubjectId: insSub.id,
                    termId: term.id,
                    score: (_a = scores[si]) !== null && _a !== void 0 ? _a : 0,
                    calculatedAt: new Date(),
                });
            }
            // Pre-create SubjectFinalGrade — the calculator will use it (isClosedPeriod=true)
            const finalScore = (_b = scores[si]) !== null && _b !== void 0 ? _b : 0;
            const status = finalScore >= 10 ? 'aprobada' : 'reprobada';
            yield index_1.SubjectFinalGrade.create({
                inscriptionSubjectId: insSub.id,
                finalScore,
                rawScore: finalScore,
                councilPoints: 0,
                status,
                calculatedAt: new Date(),
                gradeType: 'regular',
                schoolPeriodId: setup.currentPeriod.id,
                subjectId: subject.id,
                gradeId: grade.id,
            });
        }
        return { person, inscription, inscriptionSubjects };
    });
}
/**
 * Creates a pending subject for a student, linked to an inscription.
 * This simulates a student who already has pending subjects from a previous period.
 */
function createPendingSubjectForStudent(setup_1, student_1, subjectIndex_1, originPeriodId_1) {
    return __awaiter(this, arguments, void 0, function* (setup, student, subjectIndex, originPeriodId, status = 'pendiente') {
        const subject = setup.subjects[subjectIndex];
        return yield index_1.PendingSubject.create({
            newInscriptionId: student.inscription.id,
            subjectId: subject.id,
            originPeriodId: originPeriodId !== null && originPeriodId !== void 0 ? originPeriodId : setup.currentPeriod.id,
            status,
        });
    });
}
/**
 * Marks all council checklists as done for the current period.
 */
function markCouncilsDone(setup) {
    return __awaiter(this, void 0, void 0, function* () {
        for (let gi = 0; gi < setup.grades.length; gi++) {
            for (const term of setup.terms) {
                yield index_1.CouncilChecklist.create({
                    schoolPeriodId: setup.currentPeriod.id,
                    gradeId: setup.grades[gi].id,
                    sectionId: setup.sections[gi].id,
                    termId: term.id,
                    status: 'done',
                    completedAt: new Date(),
                });
            }
        }
    });
}
/**
 * Creates a revision period in 'completed' status.
 */
function createCompletedRevisionPeriod(setup) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield index_1.RevisionPeriod.create({
            schoolPeriodId: setup.currentPeriod.id,
            status: 'completed',
            maxOpportunities: 3,
            passingGrade: 10,
            currentOpportunity: 1,
            completedAt: new Date(),
        });
    });
}
/**
 * Executes the closure and returns the result.
 */
function executeClosure(setup) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield periodClosureExecutor_1.PeriodClosureExecutor.executeClosure(setup.currentPeriod.id, setup.masterUser.id);
    });
}
/**
 * Validates the closure (without executing).
 */
function validateClosure(setup) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield periodClosureExecutor_1.PeriodClosureExecutor.validateClosure(setup.currentPeriod.id);
    });
}
/**
 * Creates a separate materia_pendiente inscription for a student in the
 * current period, with InscriptionSubject + PendingSubject for each subject
 * index provided. This mirrors the real production flow where MP subjects
 * live in their own inscription (not the regular/repeater one).
 */
function createSeparateMPInscription(setup_1, student_1, subjectIndices_1) {
    return __awaiter(this, arguments, void 0, function* (setup, student, subjectIndices, options = {}) {
        var _a;
        const suffix = nextId();
        const status = (_a = options.status) !== null && _a !== void 0 ? _a : 'pendiente';
        // The MP inscription lives in the grade where the pending subjects are
        // coursed (defaults to the student's current grade for backwards compat).
        const mpGradeId = options.gradeIndex != null
            ? setup.grades[options.gradeIndex].id
            : student.inscription.gradeId;
        // Find or create the "Materia Pendiente" section (stored uppercase by the
        // Section beforeCreate hook; look it up in uppercase so the find matches
        // under case-sensitive collations like SQLite)
        const [mpSection] = yield index_1.Section.findOrCreate({
            where: { name: 'MATERIA PENDIENTE' },
            defaults: { name: 'MATERIA PENDIENTE' },
        });
        const mpInscription = yield index_1.Inscription.create({
            personId: student.person.id,
            schoolPeriodId: setup.currentPeriod.id,
            gradeId: mpGradeId,
            sectionId: mpSection.id,
            escolaridad: 'materia_pendiente',
            originPeriodId: setup.currentPeriod.id,
            isRepeater: false,
        });
        const pendingSubjects = new Map();
        for (const si of subjectIndices) {
            const subject = setup.subjects[si];
            const insSub = yield index_1.InscriptionSubject.create({
                inscriptionId: mpInscription.id,
                subjectId: subject.id,
                schoolPeriodId: setup.currentPeriod.id,
                gradeId: mpGradeId,
                sectionId: mpSection.id,
            });
            const pending = yield index_1.PendingSubject.create({
                newInscriptionId: mpInscription.id,
                subjectId: subject.id,
                originPeriodId: setup.currentPeriod.id,
                status,
            });
            pendingSubjects.set(si, pending);
        }
        return { mpInscription, pendingSubjects };
    });
}
/**
 * Creates an InscriptionSubjectRevision (repair attempt) for a given
 * InscriptionSubject. The `gradedBy` field controls whether this is a
 * manual grade (Person.id) or an automatic NP marker (null).
 */
function createRevisionGrade(setup_1, inscriptionSubjectId_1, opportunity_1, score_1) {
    return __awaiter(this, arguments, void 0, function* (setup, inscriptionSubjectId, opportunity, score, options = {}) {
        var _a, _b, _c;
        const revisionPeriod = yield index_1.RevisionPeriod.findOne({
            where: { schoolPeriodId: setup.currentPeriod.id },
        });
        if (!revisionPeriod) {
            throw new Error('No RevisionPeriod found — call createCompletedRevisionPeriod first');
        }
        const passingGrade = (_a = revisionPeriod.passingGrade) !== null && _a !== void 0 ? _a : 10;
        const numericScore = score;
        const isApproved = numericScore != null && numericScore >= passingGrade;
        const status = numericScore == null ? 'pending' : isApproved ? 'approved' : 'failed';
        return yield index_1.InscriptionSubjectRevision.create({
            revisionPeriodId: revisionPeriod.id,
            inscriptionSubjectId,
            opportunity,
            score: numericScore,
            status,
            isAbsent: (_b = options.isAbsent) !== null && _b !== void 0 ? _b : false,
            gradedBy: (_c = options.gradedBy) !== null && _c !== void 0 ? _c : null,
            gradedAt: options.gradedBy != null ? new Date() : null,
        });
    });
}
/**
 * Removes the pre-created SubjectFinalGrade (gradeType='regular') for a
 * given InscriptionSubject, simulating the real pre-closure state where
 * final grades haven't been persisted yet.
 */
function removeRegularFinalGrade(inscriptionSubjectId) {
    return __awaiter(this, void 0, void 0, function* () {
        yield index_1.SubjectFinalGrade.destroy({
            where: { inscriptionSubjectId, gradeType: 'regular' },
        });
    });
}
