import User from './User';
import Person from './Person';
import Role from './Role';
import PersonRole from './PersonRole';
import Contact from './Contact';
import PersonResidence from './PersonResidence';
import StudentGuardian from './StudentGuardian';
import StudentPreviousSchool from './StudentPreviousSchool';
import Plantel from './Plantel';
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
import SubjectFinalGrade from './SubjectFinalGrade';
import StudentPeriodOutcome from './StudentPeriodOutcome';
import PendingSubject from './PendingSubject';
import SchoolPeriodTransitionRule from './SchoolPeriodTransitionRule';


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

// 5. Evaluation and Qualification Associations
PeriodGradeSubject.hasMany(EvaluationPlan, { foreignKey: 'periodGradeSubjectId', as: 'evaluationPlans' });
EvaluationPlan.belongsTo(PeriodGradeSubject, { foreignKey: 'periodGradeSubjectId', as: 'periodGradeSubject' });

Term.hasMany(EvaluationPlan, { foreignKey: 'termId', as: 'evaluationPlans' });
EvaluationPlan.belongsTo(Term, { foreignKey: 'termId', as: 'term' });

EvaluationPlan.hasMany(Qualification, { foreignKey: 'evaluationPlanId', as: 'qualifications' });
Qualification.belongsTo(EvaluationPlan, { foreignKey: 'evaluationPlanId', as: 'evaluationPlan' });

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

// Enrollment questions and answers
EnrollmentQuestion.hasMany(EnrollmentAnswer, { foreignKey: 'questionId', as: 'answers' });
EnrollmentAnswer.belongsTo(EnrollmentQuestion, { foreignKey: 'questionId', as: 'question' });

Person.hasMany(EnrollmentAnswer, { foreignKey: 'personId', as: 'enrollmentAnswers' });
EnrollmentAnswer.belongsTo(Person, { foreignKey: 'personId', as: 'student' });

// Subject final grades
InscriptionSubject.hasOne(SubjectFinalGrade, { foreignKey: 'inscriptionSubjectId', as: 'finalGrade' });
SubjectFinalGrade.belongsTo(InscriptionSubject, { foreignKey: 'inscriptionSubjectId', as: 'inscriptionSubject' });

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

// Transition rules
Grade.hasOne(SchoolPeriodTransitionRule, { foreignKey: 'gradeFromId', as: 'transitionRule' });
SchoolPeriodTransitionRule.belongsTo(Grade, { foreignKey: 'gradeFromId', as: 'gradeFrom' });
Grade.hasMany(SchoolPeriodTransitionRule, { foreignKey: 'gradeToId', as: 'incomingTransitions' });
SchoolPeriodTransitionRule.belongsTo(Grade, { foreignKey: 'gradeToId', as: 'gradeTo' });

export {
  User,
  Person,
  Role,
  PersonRole,
  Contact,
  PersonResidence,
  StudentGuardian,
  GuardianProfile,
  StudentPreviousSchool,
  Plantel,
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
  SubjectFinalGrade,
  StudentPeriodOutcome,
  PendingSubject,
  SchoolPeriodTransitionRule
};
