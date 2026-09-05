import User from './User';
import Person, { PersonCreationAttributes } from './Person';
import Role from './Role';
import PersonRole from './PersonRole';
import Contact, { ContactCreationAttributes } from './Contact';
import PersonResidence from './PersonResidence';
import StudentGuardian from './StudentGuardian';
import StudentPreviousSchool from './StudentPreviousSchool';
import Plantel from './Plantel';
import PersonPlantel from './PersonPlantel';
import GuardianProfile from './GuardianProfile';

// User <-> Person Association
User.hasOne(Person, {
  foreignKey: 'userId',
  as: 'person'
});

Person.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// Person <-> Contact Association (One-to-One)
Person.hasOne(Contact, {
  foreignKey: 'personId',
  as: 'contact'
});

Contact.belongsTo(Person, {
  foreignKey: 'personId',
  as: 'person'
});

// Person <-> PersonResidence Association (One-to-One)
Person.hasOne(PersonResidence, {
  foreignKey: 'personId',
  as: 'residence'
});

PersonResidence.belongsTo(Person, {
  foreignKey: 'personId',
  as: 'person'
});

// Person <-> StudentGuardian Association (One-to-Many)
Person.hasMany(StudentGuardian, {
  foreignKey: 'studentId',
  as: 'guardians'
});

StudentGuardian.belongsTo(Person, {
  foreignKey: 'studentId',
  as: 'student'
});

// GuardianProfile <-> StudentGuardian Association (One-to-Many)
GuardianProfile.hasMany(StudentGuardian, {
  foreignKey: 'guardianId',
  as: 'assignments'
});

StudentGuardian.belongsTo(GuardianProfile, {
  foreignKey: 'guardianId',
  as: 'profile'
});

// Person <-> StudentPreviousSchool Association (One-to-Many)
Person.hasMany(StudentPreviousSchool, {
  foreignKey: 'personId',
  as: 'previousSchools'
});

StudentPreviousSchool.belongsTo(Person, {
  foreignKey: 'personId',
  as: 'student'
});

// Person <-> Role Association (Many-to-Many)
Person.belongsToMany(Role, {
  through: PersonRole,
  foreignKey: 'personId',
  otherKey: 'roleId',
  as: 'roles'
});

import SchoolPeriod from './SchoolPeriod';
import Grade from './Grade';
import Section from './Section';
import PeriodGrade from './PeriodGrade';
import PeriodGradeSection from './PeriodGradeSection';

// ... (Existing User/Person/Role/Contact associations) ...

// Educational Structure Associations

import Subject from './Subject';
import SubjectGroup from './SubjectGroup';
import PeriodGradeSubject from './PeriodGradeSubject';
import Specialization from './Specialization';
import Inscription from './Inscription';
import InscriptionSubject from './InscriptionSubject';
import EvaluationPlan from './EvaluationPlan';
import Qualification from './Qualification';
import TeacherAssignment from './TeacherAssignment';
import Setting from './Setting';
import Term from './Term';
import Matriculation from './Matriculation';
import EnrollmentQuestion from './EnrollmentQuestion';
import EnrollmentAnswer from './EnrollmentAnswer';
import CouncilPoint from './CouncilPoint';
import PeriodClosure from './PeriodClosure';
import CouncilChecklist from './CouncilChecklist';
import TermSectionClosure from './TermSectionClosure';
import SubjectFinalGrade from './SubjectFinalGrade';
import SubjectTermGrade from './SubjectTermGrade';
import HistoricalGrade from './HistoricalGrade';
import StudentPeriodOutcome from './StudentPeriodOutcome';
import PendingSubject from './PendingSubject';
import PendingSubjectEncounter from './PendingSubjectEncounter';
import PendingSubjectContent from './PendingSubjectContent';
import PendingSubjectContentItem from './PendingSubjectContentItem';
import SchoolPeriodTransitionRule from './SchoolPeriodTransitionRule';
import EnrollmentDocument from './EnrollmentDocument';
import GradeEditPermission from './GradeEditPermission';
import GradeEditAudit from './GradeEditAudit';
import EnrollmentReport from './EnrollmentReport';
import DashboardContent from './DashboardContent';
import QualificationAudit from './QualificationAudit';
import RevisionPeriod from './RevisionPeriod';
import InscriptionSubjectRevision from './InscriptionSubjectRevision';
import RevisionGradeEditAudit from './RevisionGradeEditAudit';
import RevisionThematicSelection from './RevisionThematicSelection';
import RevisionOpportunityDate from './RevisionOpportunityDate';
import InscriptionGroupTermChoice from './InscriptionGroupTermChoice';
import ThematicComponent from './ThematicComponent';
import ThematicContent from './ThematicContent';
import ExpectedLearning from './ExpectedLearning';
import ExpectedLearningContent from './ExpectedLearningContent';
import EvaluationCriteria from './EvaluationCriteria';
import EvaluationIndicator from './EvaluationIndicator';
import EvaluationCatalog from './EvaluationCatalog';
import SectionGuide from './SectionGuide';
import StudentObservation from './StudentObservation';
import SubjectPreset from './SubjectPreset';
import StructurePreset from './StructurePreset';
import ExchangeRateType from './ExchangeRateType';
import ExchangeRate from './ExchangeRate';
import Fee from './Fee';
import SellableItem from './SellableItem';
import EnrollmentPlan from './EnrollmentPlan';
import EnrollmentPlanItem from './EnrollmentPlanItem';
import Payment from './Payment';
import Charge from './Charge';
import ConstanciaTemplate from './ConstanciaTemplate';
import TeacherAvailability from './TeacherAvailability';
import Schedule from './Schedule';
import ScheduleEntry from './ScheduleEntry';
import ScheduleException from './ScheduleException';
import ClassroomAssignment from './ClassroomAssignment';
import RoomBooking from './RoomBooking';
import GradeChangeLog from './GradeChangeLog';


// ... (Existing User/Person/Role/Contact associations) ...

// Educational Structure Associations

// 1. SchoolPeriod <-> Grade
SchoolPeriod.belongsToMany(Grade, { through: PeriodGrade, foreignKey: 'schoolPeriodId', otherKey: 'gradeId', as: 'grades' });
Grade.belongsToMany(SchoolPeriod, { through: PeriodGrade, foreignKey: 'gradeId', otherKey: 'schoolPeriodId', as: 'periods' });
PeriodGrade.belongsTo(SchoolPeriod, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });
PeriodGrade.belongsTo(Grade, { foreignKey: 'gradeId', as: 'grade' });
PeriodGrade.belongsTo(Specialization, { foreignKey: 'specializationId', as: 'specialization' });
Specialization.hasMany(PeriodGrade, { foreignKey: 'specializationId', as: 'periodGrades' });

// 2. PeriodGrade <-> Section
PeriodGrade.belongsToMany(Section, { through: PeriodGradeSection, foreignKey: 'periodGradeId', otherKey: 'sectionId', as: 'sections' });
Section.belongsToMany(PeriodGrade, { through: PeriodGradeSection, foreignKey: 'sectionId', otherKey: 'periodGradeId', as: 'periodGrades' });
PeriodGradeSection.belongsTo(PeriodGrade, { foreignKey: 'periodGradeId', as: 'periodGrade' });
PeriodGradeSection.belongsTo(Section, { foreignKey: 'sectionId', as: 'section' });

// 3. PeriodGrade <-> Subject
PeriodGrade.belongsToMany(Subject, { through: PeriodGradeSubject, foreignKey: 'periodGradeId', otherKey: 'subjectId', as: 'subjects' });
Subject.belongsToMany(PeriodGrade, { through: PeriodGradeSubject, foreignKey: 'subjectId', otherKey: 'periodGradeId', as: 'periodGrades' });
PeriodGradeSubject.belongsTo(PeriodGrade, { foreignKey: 'periodGradeId', as: 'periodGrade' });
PeriodGradeSubject.belongsTo(Subject, { foreignKey: 'subjectId', as: 'subject' });

// SubjectGroup <-> Subject
SubjectGroup.hasMany(Subject, { foreignKey: 'subjectGroupId', as: 'subjects' });
Subject.belongsTo(SubjectGroup, { foreignKey: 'subjectGroupId', as: 'subjectGroup' });

// 4. Inscription Associations
Inscription.belongsTo(SchoolPeriod, { foreignKey: 'schoolPeriodId', as: 'period' });
SchoolPeriod.hasMany(Inscription, { foreignKey: 'schoolPeriodId', as: 'inscriptions' });

Inscription.belongsTo(SchoolPeriod, { foreignKey: 'originPeriodId', as: 'originPeriod' });

Inscription.belongsTo(Grade, { foreignKey: 'gradeId', as: 'grade' });
Grade.hasMany(Inscription, { foreignKey: 'gradeId', as: 'inscriptions' });

Inscription.belongsTo(Section, { foreignKey: 'sectionId', as: 'section' });
Section.hasMany(Inscription, { foreignKey: 'sectionId', as: 'inscriptions' });

Inscription.belongsTo(Person, { foreignKey: 'personId', as: 'student' });
Person.hasMany(Inscription, { foreignKey: 'personId', as: 'inscriptions' });

// Inscription <-> InscriptionSubject (One-to-Many for easier access)
Inscription.hasMany(InscriptionSubject, { foreignKey: 'inscriptionId', as: 'inscriptionSubjects' });

// Inscription <-> Subject (Many-to-Many)
Inscription.belongsToMany(Subject, { through: InscriptionSubject, foreignKey: 'inscriptionId', otherKey: 'subjectId', as: 'subjects' });
Subject.belongsToMany(Inscription, { through: InscriptionSubject, foreignKey: 'subjectId', otherKey: 'inscriptionId', as: 'inscriptions' });
InscriptionSubject.belongsTo(Inscription, { foreignKey: 'inscriptionId', as: 'inscription' });
InscriptionSubject.belongsTo(Subject, { foreignKey: 'subjectId', as: 'subject' });

// Matriculation associations
Matriculation.belongsTo(Person, { foreignKey: 'personId', as: 'student' });
Person.hasMany(Matriculation, { foreignKey: 'personId', as: 'matriculations' });

Matriculation.belongsTo(SchoolPeriod, { foreignKey: 'schoolPeriodId', as: 'period' });
SchoolPeriod.hasMany(Matriculation, { foreignKey: 'schoolPeriodId', as: 'matriculations' });

Matriculation.belongsTo(Grade, { foreignKey: 'gradeId', as: 'grade' });
Grade.hasMany(Matriculation, { foreignKey: 'gradeId', as: 'matriculations' });

Matriculation.belongsTo(Section, { foreignKey: 'sectionId', as: 'section' });
Section.hasMany(Matriculation, { foreignKey: 'sectionId', as: 'matriculations' });

Matriculation.belongsTo(Inscription, { foreignKey: 'inscriptionId', as: 'inscription' });
Inscription.hasOne(Matriculation, { foreignKey: 'inscriptionId', as: 'matriculation' });

Matriculation.hasOne(EnrollmentDocument, { foreignKey: 'matriculationId', as: 'documents' });
EnrollmentDocument.belongsTo(Matriculation, { foreignKey: 'matriculationId', as: 'matriculation' });

// 5. Evaluation and Qualification Associations
PeriodGradeSubject.hasMany(EvaluationPlan, { foreignKey: 'periodGradeSubjectId', as: 'evaluationPlans' });
EvaluationPlan.belongsTo(PeriodGradeSubject, { foreignKey: 'periodGradeSubjectId', as: 'periodGradeSubject' });

Term.hasMany(EvaluationPlan, { foreignKey: 'termId', as: 'evaluationPlans' });
EvaluationPlan.belongsTo(Term, { foreignKey: 'termId', as: 'term' });

EvaluationPlan.hasMany(Qualification, { foreignKey: 'evaluationPlanId', as: 'qualifications' });
Qualification.belongsTo(EvaluationPlan, { foreignKey: 'evaluationPlanId', as: 'evaluationPlan' });

// 5.1 Thematic Component Associations
PeriodGradeSubject.hasMany(ThematicComponent, { foreignKey: 'periodGradeSubjectId', as: 'thematicComponents' });
ThematicComponent.belongsTo(PeriodGradeSubject, { foreignKey: 'periodGradeSubjectId', as: 'periodGradeSubject' });

Term.hasMany(ThematicComponent, { foreignKey: 'termId', as: 'thematicComponents' });
ThematicComponent.belongsTo(Term, { foreignKey: 'termId', as: 'term' });

ThematicComponent.hasMany(ThematicContent, { foreignKey: 'thematicComponentId', as: 'contents' });
ThematicContent.belongsTo(ThematicComponent, { foreignKey: 'thematicComponentId', as: 'thematicComponent' });

ThematicContent.belongsToMany(ExpectedLearning, { through: { model: ExpectedLearningContent, unique: false }, foreignKey: 'contentId', otherKey: 'learningId', as: 'learnings' });
ExpectedLearning.belongsToMany(ThematicContent, { through: { model: ExpectedLearningContent, unique: false }, foreignKey: 'learningId', otherKey: 'contentId', as: 'contents' });

EvaluationPlan.belongsTo(ThematicComponent, { foreignKey: 'thematicComponentId', as: 'thematicComponent' });
ThematicComponent.hasMany(EvaluationPlan, { foreignKey: 'thematicComponentId', as: 'evaluationPlans' });

// 5.2 Evaluation Criteria Associations
EvaluationPlan.hasMany(EvaluationCriteria, { foreignKey: 'evaluationPlanId', as: 'criteria' });
EvaluationCriteria.belongsTo(EvaluationPlan, { foreignKey: 'evaluationPlanId', as: 'evaluationPlan' });

// 5.3 Evaluation Indicator Associations
EvaluationCriteria.hasMany(EvaluationIndicator, { foreignKey: 'evaluationCriteriaId', as: 'indicators' });
EvaluationIndicator.belongsTo(EvaluationCriteria, { foreignKey: 'evaluationCriteriaId', as: 'criterion' });

// 5.4 Evaluation Catalog Associations
EvaluationCatalog.hasMany(EvaluationPlan, { foreignKey: 'tecnicaId', as: 'tecnicaPlans' });
EvaluationCatalog.hasMany(EvaluationPlan, { foreignKey: 'instrumentoId', as: 'instrumentoPlans' });
EvaluationCatalog.hasMany(EvaluationPlan, { foreignKey: 'estrategiaId', as: 'estrategiaPlans' });
EvaluationPlan.belongsTo(EvaluationCatalog, { foreignKey: 'tecnicaId', as: 'tecnicaCatalog' });
EvaluationPlan.belongsTo(EvaluationCatalog, { foreignKey: 'instrumentoId', as: 'instrumentoCatalog' });
EvaluationPlan.belongsTo(EvaluationCatalog, { foreignKey: 'estrategiaId', as: 'estrategiaCatalog' });

InscriptionSubject.hasMany(Qualification, { foreignKey: 'inscriptionSubjectId', as: 'qualifications' });
Qualification.belongsTo(InscriptionSubject, { foreignKey: 'inscriptionSubjectId', as: 'inscriptionSubject' });

// 5.5 Council Point Associations
InscriptionSubject.hasMany(CouncilPoint, { foreignKey: 'inscriptionSubjectId', as: 'councilPoints' });
CouncilPoint.belongsTo(InscriptionSubject, { foreignKey: 'inscriptionSubjectId', as: 'inscriptionSubject' });

Term.hasMany(CouncilPoint, { foreignKey: 'termId', as: 'councilPoints' });
CouncilPoint.belongsTo(Term, { foreignKey: 'termId', as: 'term' });


// 6. Teacher Assignment Associations
Person.hasMany(TeacherAssignment, { foreignKey: 'teacherId', as: 'teachingAssignments' });
TeacherAssignment.belongsTo(Person, { foreignKey: 'teacherId', as: 'teacher' });

PeriodGradeSubject.hasMany(TeacherAssignment, { foreignKey: 'periodGradeSubjectId', as: 'teacherAssignments' });
TeacherAssignment.belongsTo(PeriodGradeSubject, { foreignKey: 'periodGradeSubjectId', as: 'periodGradeSubject' });

Section.hasMany(TeacherAssignment, { foreignKey: 'sectionId', as: 'teacherAssignments' });
TeacherAssignment.belongsTo(Section, { foreignKey: 'sectionId', as: 'section' });

// 6b. Section Guide Associations (profesor guía)
SectionGuide.belongsTo(Person, { foreignKey: 'teacherId', as: 'guideTeacher' });
SectionGuide.belongsTo(Grade, { foreignKey: 'gradeId', as: 'grade' });
SectionGuide.belongsTo(Section, { foreignKey: 'sectionId', as: 'section' });
SectionGuide.belongsTo(SchoolPeriod, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });

// 6c. Student Observation Associations (observaciones del profesor guía)
StudentObservation.belongsTo(Inscription, { foreignKey: 'inscriptionId', as: 'inscription' });
StudentObservation.belongsTo(Term, { foreignKey: 'termId', as: 'term' });
StudentObservation.belongsTo(SchoolPeriod, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });
StudentObservation.belongsTo(Person, { foreignKey: 'teacherId', as: 'teacher' });
Inscription.hasMany(StudentObservation, { foreignKey: 'inscriptionId', as: 'observations' });

// Term associations
SchoolPeriod.hasMany(Term, { foreignKey: 'schoolPeriodId', as: 'terms' });
Term.belongsTo(SchoolPeriod, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });

// Period closure and council checklist associations
SchoolPeriod.hasMany(PeriodClosure, { foreignKey: 'schoolPeriodId', as: 'closures' });
PeriodClosure.belongsTo(SchoolPeriod, { foreignKey: 'schoolPeriodId', as: 'period' });
PeriodClosure.belongsTo(User, { foreignKey: 'initiatedBy', as: 'initiator' });

SchoolPeriod.hasMany(CouncilChecklist, { foreignKey: 'schoolPeriodId', as: 'councilChecklists' });
Grade.hasMany(CouncilChecklist, { foreignKey: 'gradeId', as: 'councilChecklists' });
Section.hasMany(CouncilChecklist, { foreignKey: 'sectionId', as: 'councilChecklists' });
Term.hasMany(CouncilChecklist, { foreignKey: 'termId', as: 'councilChecklists' });
CouncilChecklist.belongsTo(SchoolPeriod, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });
CouncilChecklist.belongsTo(Grade, { foreignKey: 'gradeId', as: 'grade' });
CouncilChecklist.belongsTo(Section, { foreignKey: 'sectionId', as: 'section' });
CouncilChecklist.belongsTo(Term, { foreignKey: 'termId', as: 'term' });
CouncilChecklist.belongsTo(User, { foreignKey: 'completedBy', as: 'completedByUser' });

// TermSectionClosure associations (per-section term closure)
Term.hasMany(TermSectionClosure, { foreignKey: 'termId', as: 'sectionClosures' });
TermSectionClosure.belongsTo(Term, { foreignKey: 'termId', as: 'term' });
Section.hasMany(TermSectionClosure, { foreignKey: 'sectionId', as: 'termClosures' });
TermSectionClosure.belongsTo(Section, { foreignKey: 'sectionId', as: 'section' });
Grade.hasMany(TermSectionClosure, { foreignKey: 'gradeId', as: 'termClosures' });
TermSectionClosure.belongsTo(Grade, { foreignKey: 'gradeId', as: 'grade' });
TermSectionClosure.belongsTo(User, { foreignKey: 'closedBy', as: 'closedByUser' });

// Enrollment questions and answers
EnrollmentQuestion.hasMany(EnrollmentAnswer, { foreignKey: 'questionId', as: 'answers' });
EnrollmentAnswer.belongsTo(EnrollmentQuestion, { foreignKey: 'questionId', as: 'question' });

Person.hasMany(EnrollmentAnswer, { foreignKey: 'personId', as: 'enrollmentAnswers' });
EnrollmentAnswer.belongsTo(Person, { foreignKey: 'personId', as: 'student' });

// Teacher Availability
Person.hasMany(TeacherAvailability, { foreignKey: 'personId', as: 'availability' });
TeacherAvailability.belongsTo(Person, { foreignKey: 'personId', as: 'person' });

// Schedules
PeriodGradeSection.hasOne(Schedule, { foreignKey: 'periodGradeSectionId', as: 'schedule' });
Schedule.belongsTo(PeriodGradeSection, { foreignKey: 'periodGradeSectionId', as: 'section' });
Schedule.hasMany(ScheduleEntry, { foreignKey: 'scheduleId', as: 'entries' });
ScheduleEntry.belongsTo(Schedule, { foreignKey: 'scheduleId', as: 'schedule' });
ScheduleEntry.belongsTo(Subject, { foreignKey: 'subjectId', as: 'subject' });
ScheduleEntry.belongsTo(Person, { foreignKey: 'teacherId', as: 'teacher' });

// Schedule exceptions (per-subject overrides for the automatic generator)
ScheduleException.belongsTo(Subject, { foreignKey: 'subjectId', as: 'subject' });
Subject.hasOne(ScheduleException, { foreignKey: 'subjectId', as: 'scheduleException' });

// Classroom assignments (room <-> section/subject)
ClassroomAssignment.belongsTo(Subject, { foreignKey: 'subjectId', as: 'subject' });

// Subject final grades
InscriptionSubject.hasOne(SubjectFinalGrade, { foreignKey: 'inscriptionSubjectId', as: 'finalGrade' });
SubjectFinalGrade.belongsTo(InscriptionSubject, { foreignKey: 'inscriptionSubjectId', as: 'inscriptionSubject' });

SubjectFinalGrade.belongsTo(Plantel, { foreignKey: 'plantelId', as: 'plantel' });
Plantel.hasMany(SubjectFinalGrade, { foreignKey: 'plantelId', as: 'finalGrades' });

// Subject term grades (per-lapso scores)
InscriptionSubject.hasMany(SubjectTermGrade, { foreignKey: 'inscriptionSubjectId', as: 'termGrades' });
SubjectTermGrade.belongsTo(InscriptionSubject, { foreignKey: 'inscriptionSubjectId', as: 'inscriptionSubject' });
SubjectTermGrade.belongsTo(Term, { foreignKey: 'termId', as: 'term' });
Term.hasMany(SubjectTermGrade, { foreignKey: 'termId', as: 'termGrades' });

// Historical grades (legacy data without InscriptionSubject)
HistoricalGrade.belongsTo(Person, { foreignKey: 'personId', as: 'person' });
Person.hasMany(HistoricalGrade, { foreignKey: 'personId', as: 'historicalGrades' });
HistoricalGrade.belongsTo(Grade, { foreignKey: 'gradeId', as: 'grade' });
HistoricalGrade.belongsTo(Subject, { foreignKey: 'subjectId', as: 'subject' });
HistoricalGrade.belongsTo(SchoolPeriod, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });
HistoricalGrade.belongsTo(Plantel, { foreignKey: 'plantelId', as: 'plantel' });

// Person-Plantel relationship (ordered list of planteles per student)
Person.belongsToMany(Plantel, {
  through: PersonPlantel,
  foreignKey: 'personId',
  otherKey: 'plantelId',
  as: 'planteles',
});
Plantel.belongsToMany(Person, {
  through: PersonPlantel,
  foreignKey: 'plantelId',
  otherKey: 'personId',
  as: 'persons',
});
PersonPlantel.belongsTo(Person, { foreignKey: 'personId', as: 'person' });
PersonPlantel.belongsTo(Plantel, { foreignKey: 'plantelId', as: 'plantel' });

// Student period outcomes
Inscription.hasOne(StudentPeriodOutcome, { foreignKey: 'inscriptionId', as: 'periodOutcome' });
StudentPeriodOutcome.belongsTo(Inscription, { foreignKey: 'inscriptionId', as: 'inscription' });
Grade.hasMany(StudentPeriodOutcome, { foreignKey: 'promotionGradeId', as: 'incomingStudents' });
StudentPeriodOutcome.belongsTo(Grade, { foreignKey: 'promotionGradeId', as: 'promotionGrade' });

// Pending subjects
Inscription.hasMany(PendingSubject, { foreignKey: 'newInscriptionId', as: 'pendingSubjects' });
PendingSubject.belongsTo(Inscription, { foreignKey: 'newInscriptionId', as: 'inscription' });
Subject.hasMany(PendingSubject, { foreignKey: 'subjectId', as: 'pendingAssignments' });
PendingSubject.belongsTo(Subject, { foreignKey: 'subjectId', as: 'subject' });
SchoolPeriod.hasMany(PendingSubject, { foreignKey: 'originPeriodId', as: 'pendingSubjects' });
PendingSubject.belongsTo(SchoolPeriod, { foreignKey: 'originPeriodId', as: 'originPeriod' });

// Pending subject encounters (evaluaciones por encuentro)
PendingSubject.hasMany(PendingSubjectEncounter, { foreignKey: 'pendingSubjectId', as: 'encounters' });
PendingSubjectEncounter.belongsTo(PendingSubject, { foreignKey: 'pendingSubjectId', as: 'pendingSubject' });

// Pending subject content (Tema General + Contenidos)
PendingSubject.hasOne(PendingSubjectContent, { foreignKey: 'pendingSubjectId', as: 'content' });
PendingSubjectContent.belongsTo(PendingSubject, { foreignKey: 'pendingSubjectId', as: 'pendingSubject' });
PendingSubjectContent.hasMany(PendingSubjectContentItem, { foreignKey: 'contentId', as: 'items' });
PendingSubjectContentItem.belongsTo(PendingSubjectContent, { foreignKey: 'contentId', as: 'content' });

// Transition rules
Grade.hasOne(SchoolPeriodTransitionRule, { foreignKey: 'gradeFromId', as: 'transitionRule' });

// Revision period associations
SchoolPeriod.hasOne(RevisionPeriod, { foreignKey: 'schoolPeriodId', as: 'revisionPeriod' });
RevisionPeriod.belongsTo(SchoolPeriod, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });

RevisionPeriod.hasMany(InscriptionSubjectRevision, { foreignKey: 'revisionPeriodId', as: 'revisions' });
InscriptionSubjectRevision.belongsTo(RevisionPeriod, { foreignKey: 'revisionPeriodId', as: 'revisionPeriod' });

InscriptionSubject.hasMany(InscriptionSubjectRevision, { foreignKey: 'inscriptionSubjectId', as: 'revisions' });
InscriptionSubjectRevision.belongsTo(InscriptionSubject, { foreignKey: 'inscriptionSubjectId', as: 'inscriptionSubject' });

Person.hasMany(InscriptionSubjectRevision, { foreignKey: 'gradedBy', as: 'gradedRevisions' });
InscriptionSubjectRevision.belongsTo(Person, { foreignKey: 'gradedBy', as: 'grader' });

// Revision grade edit audits (extraordinary edits by Control de Estudios)
InscriptionSubjectRevision.hasMany(RevisionGradeEditAudit, { foreignKey: 'revisionId', as: 'editAudits' });
RevisionGradeEditAudit.belongsTo(InscriptionSubjectRevision, { foreignKey: 'revisionId', as: 'revision' });
RevisionGradeEditAudit.belongsTo(Person, { foreignKey: 'editedBy', as: 'editor' });

// Revision thematic selections (per subject+section within a revision period)
RevisionPeriod.hasMany(RevisionThematicSelection, { foreignKey: 'revisionPeriodId', as: 'thematicSelections' });
RevisionThematicSelection.belongsTo(RevisionPeriod, { foreignKey: 'revisionPeriodId', as: 'revisionPeriod' });
PeriodGradeSubject.hasMany(RevisionThematicSelection, { foreignKey: 'periodGradeSubjectId', as: 'revisionThematicSelections' });
RevisionThematicSelection.belongsTo(PeriodGradeSubject, { foreignKey: 'periodGradeSubjectId', as: 'periodGradeSubject' });
Section.hasMany(RevisionThematicSelection, { foreignKey: 'sectionId', as: 'revisionThematicSelections' });
RevisionThematicSelection.belongsTo(Section, { foreignKey: 'sectionId', as: 'section' });

// Revision opportunity dates (per subject+section+opportunity within a revision period)
RevisionPeriod.hasMany(RevisionOpportunityDate, { foreignKey: 'revisionPeriodId', as: 'opportunityDates' });
RevisionOpportunityDate.belongsTo(RevisionPeriod, { foreignKey: 'revisionPeriodId', as: 'revisionPeriod' });
PeriodGradeSubject.hasMany(RevisionOpportunityDate, { foreignKey: 'periodGradeSubjectId', as: 'revisionOpportunityDates' });
RevisionOpportunityDate.belongsTo(PeriodGradeSubject, { foreignKey: 'periodGradeSubjectId', as: 'periodGradeSubject' });
Section.hasMany(RevisionOpportunityDate, { foreignKey: 'sectionId', as: 'revisionOpportunityDates' });
RevisionOpportunityDate.belongsTo(Section, { foreignKey: 'sectionId', as: 'section' });

// InscriptionGroupTermChoice — per-term subject choice within a SubjectGroup.
Inscription.hasMany(InscriptionGroupTermChoice, { foreignKey: 'inscriptionId', as: 'groupTermChoices' });
InscriptionGroupTermChoice.belongsTo(Inscription, { foreignKey: 'inscriptionId', as: 'inscription' });
InscriptionGroupTermChoice.belongsTo(SubjectGroup, { foreignKey: 'subjectGroupId', as: 'subjectGroup' });
InscriptionGroupTermChoice.belongsTo(Subject, { foreignKey: 'subjectId', as: 'subject' });
InscriptionGroupTermChoice.belongsTo(Term, { foreignKey: 'termId', as: 'term' });
SchoolPeriodTransitionRule.belongsTo(Grade, { foreignKey: 'gradeFromId', as: 'gradeFrom' });
Grade.hasMany(SchoolPeriodTransitionRule, { foreignKey: 'gradeToId', as: 'incomingTransitions' });
SchoolPeriodTransitionRule.belongsTo(Grade, { foreignKey: 'gradeToId', as: 'gradeTo' });

// Grade edit permission associations
SchoolPeriod.hasMany(GradeEditPermission, { foreignKey: 'schoolPeriodId', as: 'editPermissions' });
GradeEditPermission.belongsTo(SchoolPeriod, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });

User.hasMany(GradeEditPermission, { foreignKey: 'grantedBy', as: 'grantedPermissions' });
GradeEditPermission.belongsTo(User, { foreignKey: 'grantedBy', as: 'granter' });

User.hasMany(GradeEditPermission, { foreignKey: 'grantedTo', as: 'receivedPermissions' });
GradeEditPermission.belongsTo(User, { foreignKey: 'grantedTo', as: 'recipient' });

User.hasMany(GradeEditPermission, { foreignKey: 'revokedBy', as: 'revokedPermissions' });
GradeEditPermission.belongsTo(User, { foreignKey: 'revokedBy', as: 'revoker' });

// Grade edit audit associations
SubjectFinalGrade.hasMany(GradeEditAudit, { foreignKey: 'subjectFinalGradeId', as: 'editAudits' });
GradeEditAudit.belongsTo(SubjectFinalGrade, { foreignKey: 'subjectFinalGradeId', as: 'subjectFinalGrade' });

GradeEditPermission.hasMany(GradeEditAudit, { foreignKey: 'permissionId', as: 'audits' });
GradeEditAudit.belongsTo(GradeEditPermission, { foreignKey: 'permissionId', as: 'permission' });

User.hasMany(GradeEditAudit, { foreignKey: 'editedBy', as: 'gradeEdits' });
GradeEditAudit.belongsTo(User, { foreignKey: 'editedBy', as: 'editor' });

// Qualification audit associations
Qualification.hasMany(QualificationAudit, { foreignKey: 'qualificationId', as: 'audits' });
QualificationAudit.belongsTo(Qualification, { foreignKey: 'qualificationId', as: 'qualification' });

User.hasMany(QualificationAudit, { foreignKey: 'editedBy', as: 'qualificationEdits' });
QualificationAudit.belongsTo(User, { foreignKey: 'editedBy', as: 'editor' });

// Enrollment reports
EnrollmentReport.belongsTo(Matriculation, { foreignKey: 'matriculationId', as: 'matriculation' });
Matriculation.hasMany(EnrollmentReport, { foreignKey: 'matriculationId', as: 'enrollmentReports' });

EnrollmentReport.belongsTo(Person, { foreignKey: 'personId', as: 'student' });
Person.hasMany(EnrollmentReport, { foreignKey: 'personId', as: 'enrollmentReports' });

// ── Payments module ──────────────────────────────────────────────
// ExchangeRateType <-> ExchangeRate
ExchangeRateType.hasMany(ExchangeRate, { foreignKey: 'exchangeRateTypeId', as: 'rates' });
ExchangeRate.belongsTo(ExchangeRateType, { foreignKey: 'exchangeRateTypeId', as: 'type' });

// ExchangeRateType <-> Fee
ExchangeRateType.hasMany(Fee, { foreignKey: 'exchangeRateTypeId', as: 'fees' });
Fee.belongsTo(ExchangeRateType, { foreignKey: 'exchangeRateTypeId', as: 'exchangeRateType' });

// SchoolPeriod <-> Fee
SchoolPeriod.hasMany(Fee, { foreignKey: 'schoolPeriodId', as: 'fees' });
Fee.belongsTo(SchoolPeriod, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });

// ExchangeRateType <-> SellableItem
ExchangeRateType.hasMany(SellableItem, { foreignKey: 'exchangeRateTypeId', as: 'sellableItems' });
SellableItem.belongsTo(ExchangeRateType, { foreignKey: 'exchangeRateTypeId', as: 'exchangeRateType' });

// ExchangeRateType <-> EnrollmentPlan (target currency)
ExchangeRateType.hasMany(EnrollmentPlan, { foreignKey: 'targetExchangeRateTypeId', as: 'enrollmentPlans' });
EnrollmentPlan.belongsTo(ExchangeRateType, { foreignKey: 'targetExchangeRateTypeId', as: 'targetExchangeRateType' });

// EnrollmentPlan <-> EnrollmentPlanItem
EnrollmentPlan.hasMany(EnrollmentPlanItem, { foreignKey: 'enrollmentPlanId', as: 'items' });
EnrollmentPlanItem.belongsTo(EnrollmentPlan, { foreignKey: 'enrollmentPlanId', as: 'plan' });

// EnrollmentPlan <-> SchoolPeriod
SchoolPeriod.hasMany(EnrollmentPlan, { foreignKey: 'schoolPeriodId', as: 'enrollmentPlans' });
EnrollmentPlan.belongsTo(SchoolPeriod, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });

// EnrollmentPlanItem <-> Fee
Fee.hasMany(EnrollmentPlanItem, { foreignKey: 'feeId', as: 'planItems' });
EnrollmentPlanItem.belongsTo(Fee, { foreignKey: 'feeId', as: 'fee' });

// EnrollmentPlanItem <-> SellableItem
SellableItem.hasMany(EnrollmentPlanItem, { foreignKey: 'sellableItemId', as: 'planItems' });
EnrollmentPlanItem.belongsTo(SellableItem, { foreignKey: 'sellableItemId', as: 'sellableItem' });

// ── Ledger: Payment & Charge ──

// Inscription <-> Charge (one student can have many charges in a period)
Inscription.hasMany(Charge, { foreignKey: 'inscriptionId', as: 'charges' });
Charge.belongsTo(Inscription, { foreignKey: 'inscriptionId', as: 'inscription' });

// Inscription <-> Payment
Inscription.hasMany(Payment, { foreignKey: 'inscriptionId', as: 'payments' });
Payment.belongsTo(Inscription, { foreignKey: 'inscriptionId', as: 'inscription' });

// SchoolPeriod <-> Charge
SchoolPeriod.hasMany(Charge, { foreignKey: 'schoolPeriodId', as: 'charges' });
Charge.belongsTo(SchoolPeriod, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });

// SchoolPeriod <-> Payment
SchoolPeriod.hasMany(Payment, { foreignKey: 'schoolPeriodId', as: 'payments' });
Payment.belongsTo(SchoolPeriod, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });

// Charge <-> Payment (a charge can be settled by multiple payments)
Charge.hasMany(Payment, { foreignKey: 'chargeId', as: 'payments' });
Payment.belongsTo(Charge, { foreignKey: 'chargeId', as: 'charge' });

// Fee <-> Charge (optional link)
Fee.hasMany(Charge, { foreignKey: 'feeId', as: 'charges' });
Charge.belongsTo(Fee, { foreignKey: 'feeId', as: 'fee' });

// Fee <-> Payment (optional link)
Fee.hasMany(Payment, { foreignKey: 'feeId', as: 'payments' });
Payment.belongsTo(Fee, { foreignKey: 'feeId', as: 'fee' });

// SellableItem <-> Charge
SellableItem.hasMany(Charge, { foreignKey: 'sellableItemId', as: 'charges' });
Charge.belongsTo(SellableItem, { foreignKey: 'sellableItemId', as: 'sellableItem' });

// SellableItem <-> Payment
SellableItem.hasMany(Payment, { foreignKey: 'sellableItemId', as: 'payments' });
Payment.belongsTo(SellableItem, { foreignKey: 'sellableItemId', as: 'sellableItem' });

// Grade change log (unified audit trail)
GradeChangeLog.belongsTo(User, { foreignKey: 'editedBy', as: 'editor' });
User.hasMany(GradeChangeLog, { foreignKey: 'editedBy', as: 'gradeChanges' });

export {
  User,
  Person,
  PersonCreationAttributes,
  Role,
  PersonRole,
  Contact,
  ContactCreationAttributes,
  PersonResidence,
  StudentGuardian,
  GuardianProfile,
  StudentPreviousSchool,
  Plantel,
  PersonPlantel,
  SchoolPeriod,
  Grade,
  Section,
  PeriodGrade,
  PeriodGradeSection,
  Subject,
  SubjectGroup,
  PeriodGradeSubject,
  Specialization,
  Inscription,
  InscriptionSubject,
  Matriculation,
  EvaluationPlan,
  Qualification,
  TeacherAssignment,
  Setting,
  Term,
  EnrollmentQuestion,
  EnrollmentAnswer,
  CouncilPoint,
  PeriodClosure,
  CouncilChecklist,
  TermSectionClosure,
  SubjectFinalGrade,
  SubjectTermGrade,
  HistoricalGrade,
  StudentPeriodOutcome,
  PendingSubject,
  PendingSubjectEncounter,
  PendingSubjectContent,
  PendingSubjectContentItem,
  SchoolPeriodTransitionRule,
  EnrollmentDocument,
  GradeEditPermission,
  GradeEditAudit,
  EnrollmentReport,
  DashboardContent,
  QualificationAudit,
  RevisionPeriod,
  InscriptionSubjectRevision,
  RevisionGradeEditAudit,
  RevisionThematicSelection,
  RevisionOpportunityDate,
  InscriptionGroupTermChoice,
  ThematicComponent,
  ThematicContent,
  ExpectedLearning,
  ExpectedLearningContent,
  EvaluationCriteria,
  EvaluationIndicator,
  EvaluationCatalog,
  SectionGuide,
  StudentObservation,
  SubjectPreset,
  StructurePreset,
  ExchangeRateType,
  ExchangeRate,
  Fee,
  SellableItem,
  EnrollmentPlan,
  EnrollmentPlanItem,
  Payment,
  Charge,
  ConstanciaTemplate,
  TeacherAvailability,
  Schedule,
  ScheduleEntry,
  ScheduleException,
  ClassroomAssignment,
  RoomBooking,
  GradeChangeLog
};
