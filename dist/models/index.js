"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RevisionPeriod = exports.QualificationAudit = exports.DashboardContent = exports.EnrollmentReport = exports.GradeEditAudit = exports.GradeEditPermission = exports.EnrollmentDocument = exports.SchoolPeriodTransitionRule = exports.PendingSubjectContentItem = exports.PendingSubjectContent = exports.PendingSubjectEncounter = exports.PendingSubject = exports.StudentPeriodOutcome = exports.HistoricalGrade = exports.SubjectTermGrade = exports.SubjectFinalGrade = exports.TermSectionClosure = exports.CouncilChecklist = exports.PeriodClosure = exports.CouncilPoint = exports.EnrollmentAnswer = exports.EnrollmentQuestion = exports.Term = exports.Setting = exports.TeacherAssignment = exports.Qualification = exports.EvaluationPlan = exports.Matriculation = exports.InscriptionSubject = exports.Inscription = exports.Specialization = exports.PeriodGradeSubject = exports.SubjectGroup = exports.Subject = exports.PeriodGradeSection = exports.PeriodGrade = exports.Section = exports.Grade = exports.SchoolPeriod = exports.PersonPlantel = exports.Plantel = exports.StudentPreviousSchool = exports.GuardianProfile = exports.StudentGuardian = exports.PersonResidence = exports.Contact = exports.PersonRole = exports.Role = exports.Person = exports.User = void 0;
exports.GateCheckin = exports.GateDevice = exports.IdCard = exports.ClearanceReason = exports.AttendanceAuditLog = exports.AttendanceRecord = exports.AttendanceSession = exports.QualificationEditRequest = exports.GradeChangeLog = exports.RoomBooking = exports.ClassroomAssignment = exports.ScheduleLinkItem = exports.ScheduleLink = exports.ScheduleException = exports.ScheduleEntry = exports.Schedule = exports.TeacherAvailability = exports.ConstanciaTemplate = exports.Charge = exports.Payment = exports.EnrollmentPlanItem = exports.EnrollmentPlan = exports.SellableItem = exports.Fee = exports.ExchangeRate = exports.ExchangeRateType = exports.StructurePreset = exports.SubjectPreset = exports.StudentObservation = exports.SectionGuide = exports.EvaluationCatalog = exports.EvaluationIndicator = exports.EvaluationCriteria = exports.ExpectedLearningContent = exports.ExpectedLearning = exports.ThematicContent = exports.ThematicComponent = exports.InscriptionGroupTermChoice = exports.RevisionOpportunityDate = exports.RevisionThematicSelection = exports.RevisionGradeEditAudit = exports.InscriptionSubjectRevision = void 0;
const User_1 = __importDefault(require("./User"));
exports.User = User_1.default;
const Person_1 = __importDefault(require("./Person"));
exports.Person = Person_1.default;
const Role_1 = __importDefault(require("./Role"));
exports.Role = Role_1.default;
const PersonRole_1 = __importDefault(require("./PersonRole"));
exports.PersonRole = PersonRole_1.default;
const Contact_1 = __importDefault(require("./Contact"));
exports.Contact = Contact_1.default;
const PersonResidence_1 = __importDefault(require("./PersonResidence"));
exports.PersonResidence = PersonResidence_1.default;
const StudentGuardian_1 = __importDefault(require("./StudentGuardian"));
exports.StudentGuardian = StudentGuardian_1.default;
const StudentPreviousSchool_1 = __importDefault(require("./StudentPreviousSchool"));
exports.StudentPreviousSchool = StudentPreviousSchool_1.default;
const Plantel_1 = __importDefault(require("./Plantel"));
exports.Plantel = Plantel_1.default;
const PersonPlantel_1 = __importDefault(require("./PersonPlantel"));
exports.PersonPlantel = PersonPlantel_1.default;
const GuardianProfile_1 = __importDefault(require("./GuardianProfile"));
exports.GuardianProfile = GuardianProfile_1.default;
// User <-> Person Association
User_1.default.hasOne(Person_1.default, {
    foreignKey: 'userId',
    as: 'person'
});
Person_1.default.belongsTo(User_1.default, {
    foreignKey: 'userId',
    as: 'user'
});
// Person <-> Contact Association (One-to-One)
Person_1.default.hasOne(Contact_1.default, {
    foreignKey: 'personId',
    as: 'contact'
});
Contact_1.default.belongsTo(Person_1.default, {
    foreignKey: 'personId',
    as: 'person'
});
// Person <-> PersonResidence Association (One-to-One)
Person_1.default.hasOne(PersonResidence_1.default, {
    foreignKey: 'personId',
    as: 'residence'
});
PersonResidence_1.default.belongsTo(Person_1.default, {
    foreignKey: 'personId',
    as: 'person'
});
// Person <-> StudentGuardian Association (One-to-Many)
Person_1.default.hasMany(StudentGuardian_1.default, {
    foreignKey: 'studentId',
    as: 'guardians'
});
StudentGuardian_1.default.belongsTo(Person_1.default, {
    foreignKey: 'studentId',
    as: 'student'
});
// GuardianProfile <-> StudentGuardian Association (One-to-Many)
GuardianProfile_1.default.hasMany(StudentGuardian_1.default, {
    foreignKey: 'guardianId',
    as: 'assignments'
});
StudentGuardian_1.default.belongsTo(GuardianProfile_1.default, {
    foreignKey: 'guardianId',
    as: 'profile'
});
// Person <-> StudentPreviousSchool Association (One-to-Many)
Person_1.default.hasMany(StudentPreviousSchool_1.default, {
    foreignKey: 'personId',
    as: 'previousSchools'
});
StudentPreviousSchool_1.default.belongsTo(Person_1.default, {
    foreignKey: 'personId',
    as: 'student'
});
// Person <-> Role Association (Many-to-Many)
Person_1.default.belongsToMany(Role_1.default, {
    through: PersonRole_1.default,
    foreignKey: 'personId',
    otherKey: 'roleId',
    as: 'roles'
});
const SchoolPeriod_1 = __importDefault(require("./SchoolPeriod"));
exports.SchoolPeriod = SchoolPeriod_1.default;
const Grade_1 = __importDefault(require("./Grade"));
exports.Grade = Grade_1.default;
const Section_1 = __importDefault(require("./Section"));
exports.Section = Section_1.default;
const PeriodGrade_1 = __importDefault(require("./PeriodGrade"));
exports.PeriodGrade = PeriodGrade_1.default;
const PeriodGradeSection_1 = __importDefault(require("./PeriodGradeSection"));
exports.PeriodGradeSection = PeriodGradeSection_1.default;
// ... (Existing User/Person/Role/Contact associations) ...
// Educational Structure Associations
const Subject_1 = __importDefault(require("./Subject"));
exports.Subject = Subject_1.default;
const SubjectGroup_1 = __importDefault(require("./SubjectGroup"));
exports.SubjectGroup = SubjectGroup_1.default;
const PeriodGradeSubject_1 = __importDefault(require("./PeriodGradeSubject"));
exports.PeriodGradeSubject = PeriodGradeSubject_1.default;
const Specialization_1 = __importDefault(require("./Specialization"));
exports.Specialization = Specialization_1.default;
const Inscription_1 = __importDefault(require("./Inscription"));
exports.Inscription = Inscription_1.default;
const InscriptionSubject_1 = __importDefault(require("./InscriptionSubject"));
exports.InscriptionSubject = InscriptionSubject_1.default;
const EvaluationPlan_1 = __importDefault(require("./EvaluationPlan"));
exports.EvaluationPlan = EvaluationPlan_1.default;
const Qualification_1 = __importDefault(require("./Qualification"));
exports.Qualification = Qualification_1.default;
const TeacherAssignment_1 = __importDefault(require("./TeacherAssignment"));
exports.TeacherAssignment = TeacherAssignment_1.default;
const Setting_1 = __importDefault(require("./Setting"));
exports.Setting = Setting_1.default;
const Term_1 = __importDefault(require("./Term"));
exports.Term = Term_1.default;
const Matriculation_1 = __importDefault(require("./Matriculation"));
exports.Matriculation = Matriculation_1.default;
const EnrollmentQuestion_1 = __importDefault(require("./EnrollmentQuestion"));
exports.EnrollmentQuestion = EnrollmentQuestion_1.default;
const EnrollmentAnswer_1 = __importDefault(require("./EnrollmentAnswer"));
exports.EnrollmentAnswer = EnrollmentAnswer_1.default;
const CouncilPoint_1 = __importDefault(require("./CouncilPoint"));
exports.CouncilPoint = CouncilPoint_1.default;
const PeriodClosure_1 = __importDefault(require("./PeriodClosure"));
exports.PeriodClosure = PeriodClosure_1.default;
const CouncilChecklist_1 = __importDefault(require("./CouncilChecklist"));
exports.CouncilChecklist = CouncilChecklist_1.default;
const TermSectionClosure_1 = __importDefault(require("./TermSectionClosure"));
exports.TermSectionClosure = TermSectionClosure_1.default;
const SubjectFinalGrade_1 = __importDefault(require("./SubjectFinalGrade"));
exports.SubjectFinalGrade = SubjectFinalGrade_1.default;
const SubjectTermGrade_1 = __importDefault(require("./SubjectTermGrade"));
exports.SubjectTermGrade = SubjectTermGrade_1.default;
const HistoricalGrade_1 = __importDefault(require("./HistoricalGrade"));
exports.HistoricalGrade = HistoricalGrade_1.default;
const StudentPeriodOutcome_1 = __importDefault(require("./StudentPeriodOutcome"));
exports.StudentPeriodOutcome = StudentPeriodOutcome_1.default;
const PendingSubject_1 = __importDefault(require("./PendingSubject"));
exports.PendingSubject = PendingSubject_1.default;
const PendingSubjectEncounter_1 = __importDefault(require("./PendingSubjectEncounter"));
exports.PendingSubjectEncounter = PendingSubjectEncounter_1.default;
const PendingSubjectContent_1 = __importDefault(require("./PendingSubjectContent"));
exports.PendingSubjectContent = PendingSubjectContent_1.default;
const PendingSubjectContentItem_1 = __importDefault(require("./PendingSubjectContentItem"));
exports.PendingSubjectContentItem = PendingSubjectContentItem_1.default;
const SchoolPeriodTransitionRule_1 = __importDefault(require("./SchoolPeriodTransitionRule"));
exports.SchoolPeriodTransitionRule = SchoolPeriodTransitionRule_1.default;
const EnrollmentDocument_1 = __importDefault(require("./EnrollmentDocument"));
exports.EnrollmentDocument = EnrollmentDocument_1.default;
const GradeEditPermission_1 = __importDefault(require("./GradeEditPermission"));
exports.GradeEditPermission = GradeEditPermission_1.default;
const GradeEditAudit_1 = __importDefault(require("./GradeEditAudit"));
exports.GradeEditAudit = GradeEditAudit_1.default;
const EnrollmentReport_1 = __importDefault(require("./EnrollmentReport"));
exports.EnrollmentReport = EnrollmentReport_1.default;
const DashboardContent_1 = __importDefault(require("./DashboardContent"));
exports.DashboardContent = DashboardContent_1.default;
const QualificationAudit_1 = __importDefault(require("./QualificationAudit"));
exports.QualificationAudit = QualificationAudit_1.default;
const RevisionPeriod_1 = __importDefault(require("./RevisionPeriod"));
exports.RevisionPeriod = RevisionPeriod_1.default;
const InscriptionSubjectRevision_1 = __importDefault(require("./InscriptionSubjectRevision"));
exports.InscriptionSubjectRevision = InscriptionSubjectRevision_1.default;
const RevisionGradeEditAudit_1 = __importDefault(require("./RevisionGradeEditAudit"));
exports.RevisionGradeEditAudit = RevisionGradeEditAudit_1.default;
const RevisionThematicSelection_1 = __importDefault(require("./RevisionThematicSelection"));
exports.RevisionThematicSelection = RevisionThematicSelection_1.default;
const RevisionOpportunityDate_1 = __importDefault(require("./RevisionOpportunityDate"));
exports.RevisionOpportunityDate = RevisionOpportunityDate_1.default;
const InscriptionGroupTermChoice_1 = __importDefault(require("./InscriptionGroupTermChoice"));
exports.InscriptionGroupTermChoice = InscriptionGroupTermChoice_1.default;
const ThematicComponent_1 = __importDefault(require("./ThematicComponent"));
exports.ThematicComponent = ThematicComponent_1.default;
const ThematicContent_1 = __importDefault(require("./ThematicContent"));
exports.ThematicContent = ThematicContent_1.default;
const ExpectedLearning_1 = __importDefault(require("./ExpectedLearning"));
exports.ExpectedLearning = ExpectedLearning_1.default;
const ExpectedLearningContent_1 = __importDefault(require("./ExpectedLearningContent"));
exports.ExpectedLearningContent = ExpectedLearningContent_1.default;
const EvaluationCriteria_1 = __importDefault(require("./EvaluationCriteria"));
exports.EvaluationCriteria = EvaluationCriteria_1.default;
const EvaluationIndicator_1 = __importDefault(require("./EvaluationIndicator"));
exports.EvaluationIndicator = EvaluationIndicator_1.default;
const EvaluationCatalog_1 = __importDefault(require("./EvaluationCatalog"));
exports.EvaluationCatalog = EvaluationCatalog_1.default;
const SectionGuide_1 = __importDefault(require("./SectionGuide"));
exports.SectionGuide = SectionGuide_1.default;
const StudentObservation_1 = __importDefault(require("./StudentObservation"));
exports.StudentObservation = StudentObservation_1.default;
const SubjectPreset_1 = __importDefault(require("./SubjectPreset"));
exports.SubjectPreset = SubjectPreset_1.default;
const StructurePreset_1 = __importDefault(require("./StructurePreset"));
exports.StructurePreset = StructurePreset_1.default;
const ExchangeRateType_1 = __importDefault(require("./ExchangeRateType"));
exports.ExchangeRateType = ExchangeRateType_1.default;
const ExchangeRate_1 = __importDefault(require("./ExchangeRate"));
exports.ExchangeRate = ExchangeRate_1.default;
const Fee_1 = __importDefault(require("./Fee"));
exports.Fee = Fee_1.default;
const SellableItem_1 = __importDefault(require("./SellableItem"));
exports.SellableItem = SellableItem_1.default;
const EnrollmentPlan_1 = __importDefault(require("./EnrollmentPlan"));
exports.EnrollmentPlan = EnrollmentPlan_1.default;
const EnrollmentPlanItem_1 = __importDefault(require("./EnrollmentPlanItem"));
exports.EnrollmentPlanItem = EnrollmentPlanItem_1.default;
const Payment_1 = __importDefault(require("./Payment"));
exports.Payment = Payment_1.default;
const Charge_1 = __importDefault(require("./Charge"));
exports.Charge = Charge_1.default;
const ConstanciaTemplate_1 = __importDefault(require("./ConstanciaTemplate"));
exports.ConstanciaTemplate = ConstanciaTemplate_1.default;
const TeacherAvailability_1 = __importDefault(require("./TeacherAvailability"));
exports.TeacherAvailability = TeacherAvailability_1.default;
const Schedule_1 = __importDefault(require("./Schedule"));
exports.Schedule = Schedule_1.default;
const ScheduleEntry_1 = __importDefault(require("./ScheduleEntry"));
exports.ScheduleEntry = ScheduleEntry_1.default;
const ScheduleException_1 = __importDefault(require("./ScheduleException"));
exports.ScheduleException = ScheduleException_1.default;
const ScheduleLink_1 = __importDefault(require("./ScheduleLink"));
exports.ScheduleLink = ScheduleLink_1.default;
const ScheduleLinkItem_1 = __importDefault(require("./ScheduleLinkItem"));
exports.ScheduleLinkItem = ScheduleLinkItem_1.default;
const ClassroomAssignment_1 = __importDefault(require("./ClassroomAssignment"));
exports.ClassroomAssignment = ClassroomAssignment_1.default;
const RoomBooking_1 = __importDefault(require("./RoomBooking"));
exports.RoomBooking = RoomBooking_1.default;
const GradeChangeLog_1 = __importDefault(require("./GradeChangeLog"));
exports.GradeChangeLog = GradeChangeLog_1.default;
const QualificationEditRequest_1 = __importDefault(require("./QualificationEditRequest"));
exports.QualificationEditRequest = QualificationEditRequest_1.default;
const AttendanceSession_1 = __importDefault(require("./AttendanceSession"));
exports.AttendanceSession = AttendanceSession_1.default;
const AttendanceRecord_1 = __importDefault(require("./AttendanceRecord"));
exports.AttendanceRecord = AttendanceRecord_1.default;
const AttendanceAuditLog_1 = __importDefault(require("./AttendanceAuditLog"));
exports.AttendanceAuditLog = AttendanceAuditLog_1.default;
const ClearanceReason_1 = __importDefault(require("./ClearanceReason"));
exports.ClearanceReason = ClearanceReason_1.default;
const IdCard_1 = __importDefault(require("./IdCard"));
exports.IdCard = IdCard_1.default;
const GateDevice_1 = __importDefault(require("./GateDevice"));
exports.GateDevice = GateDevice_1.default;
const GateCheckin_1 = __importDefault(require("./GateCheckin"));
exports.GateCheckin = GateCheckin_1.default;
// ... (Existing User/Person/Role/Contact associations) ...
// Educational Structure Associations
// 1. SchoolPeriod <-> Grade
SchoolPeriod_1.default.belongsToMany(Grade_1.default, { through: PeriodGrade_1.default, foreignKey: 'schoolPeriodId', otherKey: 'gradeId', as: 'grades' });
Grade_1.default.belongsToMany(SchoolPeriod_1.default, { through: PeriodGrade_1.default, foreignKey: 'gradeId', otherKey: 'schoolPeriodId', as: 'periods' });
PeriodGrade_1.default.belongsTo(SchoolPeriod_1.default, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });
PeriodGrade_1.default.belongsTo(Grade_1.default, { foreignKey: 'gradeId', as: 'grade' });
PeriodGrade_1.default.belongsTo(Specialization_1.default, { foreignKey: 'specializationId', as: 'specialization' });
Specialization_1.default.hasMany(PeriodGrade_1.default, { foreignKey: 'specializationId', as: 'periodGrades' });
// 2. PeriodGrade <-> Section
PeriodGrade_1.default.belongsToMany(Section_1.default, { through: PeriodGradeSection_1.default, foreignKey: 'periodGradeId', otherKey: 'sectionId', as: 'sections' });
Section_1.default.belongsToMany(PeriodGrade_1.default, { through: PeriodGradeSection_1.default, foreignKey: 'sectionId', otherKey: 'periodGradeId', as: 'periodGrades' });
PeriodGradeSection_1.default.belongsTo(PeriodGrade_1.default, { foreignKey: 'periodGradeId', as: 'periodGrade' });
PeriodGradeSection_1.default.belongsTo(Section_1.default, { foreignKey: 'sectionId', as: 'section' });
// 3. PeriodGrade <-> Subject
PeriodGrade_1.default.belongsToMany(Subject_1.default, { through: PeriodGradeSubject_1.default, foreignKey: 'periodGradeId', otherKey: 'subjectId', as: 'subjects' });
Subject_1.default.belongsToMany(PeriodGrade_1.default, { through: PeriodGradeSubject_1.default, foreignKey: 'subjectId', otherKey: 'periodGradeId', as: 'periodGrades' });
PeriodGradeSubject_1.default.belongsTo(PeriodGrade_1.default, { foreignKey: 'periodGradeId', as: 'periodGrade' });
PeriodGradeSubject_1.default.belongsTo(Subject_1.default, { foreignKey: 'subjectId', as: 'subject' });
// SubjectGroup <-> Subject
SubjectGroup_1.default.hasMany(Subject_1.default, { foreignKey: 'subjectGroupId', as: 'subjects' });
Subject_1.default.belongsTo(SubjectGroup_1.default, { foreignKey: 'subjectGroupId', as: 'subjectGroup' });
// 4. Inscription Associations
Inscription_1.default.belongsTo(SchoolPeriod_1.default, { foreignKey: 'schoolPeriodId', as: 'period' });
SchoolPeriod_1.default.hasMany(Inscription_1.default, { foreignKey: 'schoolPeriodId', as: 'inscriptions' });
Inscription_1.default.belongsTo(SchoolPeriod_1.default, { foreignKey: 'originPeriodId', as: 'originPeriod' });
Inscription_1.default.belongsTo(Grade_1.default, { foreignKey: 'gradeId', as: 'grade' });
Grade_1.default.hasMany(Inscription_1.default, { foreignKey: 'gradeId', as: 'inscriptions' });
Inscription_1.default.belongsTo(Section_1.default, { foreignKey: 'sectionId', as: 'section' });
Section_1.default.hasMany(Inscription_1.default, { foreignKey: 'sectionId', as: 'inscriptions' });
Inscription_1.default.belongsTo(Person_1.default, { foreignKey: 'personId', as: 'student' });
Person_1.default.hasMany(Inscription_1.default, { foreignKey: 'personId', as: 'inscriptions' });
// Inscription <-> InscriptionSubject (One-to-Many for easier access)
Inscription_1.default.hasMany(InscriptionSubject_1.default, { foreignKey: 'inscriptionId', as: 'inscriptionSubjects' });
// Inscription <-> Subject (Many-to-Many)
Inscription_1.default.belongsToMany(Subject_1.default, { through: InscriptionSubject_1.default, foreignKey: 'inscriptionId', otherKey: 'subjectId', as: 'subjects' });
Subject_1.default.belongsToMany(Inscription_1.default, { through: InscriptionSubject_1.default, foreignKey: 'subjectId', otherKey: 'inscriptionId', as: 'inscriptions' });
InscriptionSubject_1.default.belongsTo(Inscription_1.default, { foreignKey: 'inscriptionId', as: 'inscription' });
InscriptionSubject_1.default.belongsTo(Subject_1.default, { foreignKey: 'subjectId', as: 'subject' });
// Matriculation associations
Matriculation_1.default.belongsTo(Person_1.default, { foreignKey: 'personId', as: 'student' });
Person_1.default.hasMany(Matriculation_1.default, { foreignKey: 'personId', as: 'matriculations' });
Matriculation_1.default.belongsTo(SchoolPeriod_1.default, { foreignKey: 'schoolPeriodId', as: 'period' });
SchoolPeriod_1.default.hasMany(Matriculation_1.default, { foreignKey: 'schoolPeriodId', as: 'matriculations' });
Matriculation_1.default.belongsTo(Grade_1.default, { foreignKey: 'gradeId', as: 'grade' });
Grade_1.default.hasMany(Matriculation_1.default, { foreignKey: 'gradeId', as: 'matriculations' });
Matriculation_1.default.belongsTo(Section_1.default, { foreignKey: 'sectionId', as: 'section' });
Section_1.default.hasMany(Matriculation_1.default, { foreignKey: 'sectionId', as: 'matriculations' });
Matriculation_1.default.belongsTo(Inscription_1.default, { foreignKey: 'inscriptionId', as: 'inscription' });
Inscription_1.default.hasOne(Matriculation_1.default, { foreignKey: 'inscriptionId', as: 'matriculation' });
Matriculation_1.default.hasOne(EnrollmentDocument_1.default, { foreignKey: 'matriculationId', as: 'documents' });
EnrollmentDocument_1.default.belongsTo(Matriculation_1.default, { foreignKey: 'matriculationId', as: 'matriculation' });
// 5. Evaluation and Qualification Associations
PeriodGradeSubject_1.default.hasMany(EvaluationPlan_1.default, { foreignKey: 'periodGradeSubjectId', as: 'evaluationPlans' });
EvaluationPlan_1.default.belongsTo(PeriodGradeSubject_1.default, { foreignKey: 'periodGradeSubjectId', as: 'periodGradeSubject' });
Term_1.default.hasMany(EvaluationPlan_1.default, { foreignKey: 'termId', as: 'evaluationPlans' });
EvaluationPlan_1.default.belongsTo(Term_1.default, { foreignKey: 'termId', as: 'term' });
EvaluationPlan_1.default.hasMany(Qualification_1.default, { foreignKey: 'evaluationPlanId', as: 'qualifications' });
Qualification_1.default.belongsTo(EvaluationPlan_1.default, { foreignKey: 'evaluationPlanId', as: 'evaluationPlan' });
// 5.1 Thematic Component Associations
PeriodGradeSubject_1.default.hasMany(ThematicComponent_1.default, { foreignKey: 'periodGradeSubjectId', as: 'thematicComponents' });
ThematicComponent_1.default.belongsTo(PeriodGradeSubject_1.default, { foreignKey: 'periodGradeSubjectId', as: 'periodGradeSubject' });
Term_1.default.hasMany(ThematicComponent_1.default, { foreignKey: 'termId', as: 'thematicComponents' });
ThematicComponent_1.default.belongsTo(Term_1.default, { foreignKey: 'termId', as: 'term' });
ThematicComponent_1.default.hasMany(ThematicContent_1.default, { foreignKey: 'thematicComponentId', as: 'contents' });
ThematicContent_1.default.belongsTo(ThematicComponent_1.default, { foreignKey: 'thematicComponentId', as: 'thematicComponent' });
ThematicContent_1.default.belongsToMany(ExpectedLearning_1.default, { through: { model: ExpectedLearningContent_1.default, unique: false }, foreignKey: 'contentId', otherKey: 'learningId', as: 'learnings' });
ExpectedLearning_1.default.belongsToMany(ThematicContent_1.default, { through: { model: ExpectedLearningContent_1.default, unique: false }, foreignKey: 'learningId', otherKey: 'contentId', as: 'contents' });
EvaluationPlan_1.default.belongsTo(ThematicComponent_1.default, { foreignKey: 'thematicComponentId', as: 'thematicComponent' });
ThematicComponent_1.default.hasMany(EvaluationPlan_1.default, { foreignKey: 'thematicComponentId', as: 'evaluationPlans' });
// 5.2 Evaluation Criteria Associations
EvaluationPlan_1.default.hasMany(EvaluationCriteria_1.default, { foreignKey: 'evaluationPlanId', as: 'criteria' });
EvaluationCriteria_1.default.belongsTo(EvaluationPlan_1.default, { foreignKey: 'evaluationPlanId', as: 'evaluationPlan' });
// 5.3 Evaluation Indicator Associations
EvaluationCriteria_1.default.hasMany(EvaluationIndicator_1.default, { foreignKey: 'evaluationCriteriaId', as: 'indicators' });
EvaluationIndicator_1.default.belongsTo(EvaluationCriteria_1.default, { foreignKey: 'evaluationCriteriaId', as: 'criterion' });
// 5.4 Evaluation Catalog Associations
EvaluationCatalog_1.default.hasMany(EvaluationPlan_1.default, { foreignKey: 'tecnicaId', as: 'tecnicaPlans' });
EvaluationCatalog_1.default.hasMany(EvaluationPlan_1.default, { foreignKey: 'instrumentoId', as: 'instrumentoPlans' });
EvaluationCatalog_1.default.hasMany(EvaluationPlan_1.default, { foreignKey: 'estrategiaId', as: 'estrategiaPlans' });
EvaluationPlan_1.default.belongsTo(EvaluationCatalog_1.default, { foreignKey: 'tecnicaId', as: 'tecnicaCatalog' });
EvaluationPlan_1.default.belongsTo(EvaluationCatalog_1.default, { foreignKey: 'instrumentoId', as: 'instrumentoCatalog' });
EvaluationPlan_1.default.belongsTo(EvaluationCatalog_1.default, { foreignKey: 'estrategiaId', as: 'estrategiaCatalog' });
InscriptionSubject_1.default.hasMany(Qualification_1.default, { foreignKey: 'inscriptionSubjectId', as: 'qualifications' });
Qualification_1.default.belongsTo(InscriptionSubject_1.default, { foreignKey: 'inscriptionSubjectId', as: 'inscriptionSubject' });
// 5.5 Council Point Associations
InscriptionSubject_1.default.hasMany(CouncilPoint_1.default, { foreignKey: 'inscriptionSubjectId', as: 'councilPoints' });
CouncilPoint_1.default.belongsTo(InscriptionSubject_1.default, { foreignKey: 'inscriptionSubjectId', as: 'inscriptionSubject' });
Term_1.default.hasMany(CouncilPoint_1.default, { foreignKey: 'termId', as: 'councilPoints' });
CouncilPoint_1.default.belongsTo(Term_1.default, { foreignKey: 'termId', as: 'term' });
// 6. Teacher Assignment Associations
Person_1.default.hasMany(TeacherAssignment_1.default, { foreignKey: 'teacherId', as: 'teachingAssignments' });
TeacherAssignment_1.default.belongsTo(Person_1.default, { foreignKey: 'teacherId', as: 'teacher' });
PeriodGradeSubject_1.default.hasMany(TeacherAssignment_1.default, { foreignKey: 'periodGradeSubjectId', as: 'teacherAssignments' });
TeacherAssignment_1.default.belongsTo(PeriodGradeSubject_1.default, { foreignKey: 'periodGradeSubjectId', as: 'periodGradeSubject' });
Section_1.default.hasMany(TeacherAssignment_1.default, { foreignKey: 'sectionId', as: 'teacherAssignments' });
TeacherAssignment_1.default.belongsTo(Section_1.default, { foreignKey: 'sectionId', as: 'section' });
// 6b. Section Guide Associations (profesor guía)
SectionGuide_1.default.belongsTo(Person_1.default, { foreignKey: 'teacherId', as: 'guideTeacher' });
SectionGuide_1.default.belongsTo(Grade_1.default, { foreignKey: 'gradeId', as: 'grade' });
SectionGuide_1.default.belongsTo(Section_1.default, { foreignKey: 'sectionId', as: 'section' });
SectionGuide_1.default.belongsTo(SchoolPeriod_1.default, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });
// 6c. Student Observation Associations (observaciones del profesor guía)
StudentObservation_1.default.belongsTo(Inscription_1.default, { foreignKey: 'inscriptionId', as: 'inscription' });
StudentObservation_1.default.belongsTo(Term_1.default, { foreignKey: 'termId', as: 'term' });
StudentObservation_1.default.belongsTo(SchoolPeriod_1.default, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });
StudentObservation_1.default.belongsTo(Person_1.default, { foreignKey: 'teacherId', as: 'teacher' });
Inscription_1.default.hasMany(StudentObservation_1.default, { foreignKey: 'inscriptionId', as: 'observations' });
// Term associations
SchoolPeriod_1.default.hasMany(Term_1.default, { foreignKey: 'schoolPeriodId', as: 'terms' });
Term_1.default.belongsTo(SchoolPeriod_1.default, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });
// Period closure and council checklist associations
SchoolPeriod_1.default.hasMany(PeriodClosure_1.default, { foreignKey: 'schoolPeriodId', as: 'closures' });
PeriodClosure_1.default.belongsTo(SchoolPeriod_1.default, { foreignKey: 'schoolPeriodId', as: 'period' });
PeriodClosure_1.default.belongsTo(User_1.default, { foreignKey: 'initiatedBy', as: 'initiator' });
SchoolPeriod_1.default.hasMany(CouncilChecklist_1.default, { foreignKey: 'schoolPeriodId', as: 'councilChecklists' });
Grade_1.default.hasMany(CouncilChecklist_1.default, { foreignKey: 'gradeId', as: 'councilChecklists' });
Section_1.default.hasMany(CouncilChecklist_1.default, { foreignKey: 'sectionId', as: 'councilChecklists' });
Term_1.default.hasMany(CouncilChecklist_1.default, { foreignKey: 'termId', as: 'councilChecklists' });
CouncilChecklist_1.default.belongsTo(SchoolPeriod_1.default, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });
CouncilChecklist_1.default.belongsTo(Grade_1.default, { foreignKey: 'gradeId', as: 'grade' });
CouncilChecklist_1.default.belongsTo(Section_1.default, { foreignKey: 'sectionId', as: 'section' });
CouncilChecklist_1.default.belongsTo(Term_1.default, { foreignKey: 'termId', as: 'term' });
CouncilChecklist_1.default.belongsTo(User_1.default, { foreignKey: 'completedBy', as: 'completedByUser' });
// TermSectionClosure associations (per-section term closure)
Term_1.default.hasMany(TermSectionClosure_1.default, { foreignKey: 'termId', as: 'sectionClosures' });
TermSectionClosure_1.default.belongsTo(Term_1.default, { foreignKey: 'termId', as: 'term' });
Section_1.default.hasMany(TermSectionClosure_1.default, { foreignKey: 'sectionId', as: 'termClosures' });
TermSectionClosure_1.default.belongsTo(Section_1.default, { foreignKey: 'sectionId', as: 'section' });
Grade_1.default.hasMany(TermSectionClosure_1.default, { foreignKey: 'gradeId', as: 'termClosures' });
TermSectionClosure_1.default.belongsTo(Grade_1.default, { foreignKey: 'gradeId', as: 'grade' });
TermSectionClosure_1.default.belongsTo(User_1.default, { foreignKey: 'closedBy', as: 'closedByUser' });
// Enrollment questions and answers
EnrollmentQuestion_1.default.hasMany(EnrollmentAnswer_1.default, { foreignKey: 'questionId', as: 'answers' });
EnrollmentAnswer_1.default.belongsTo(EnrollmentQuestion_1.default, { foreignKey: 'questionId', as: 'question' });
Person_1.default.hasMany(EnrollmentAnswer_1.default, { foreignKey: 'personId', as: 'enrollmentAnswers' });
EnrollmentAnswer_1.default.belongsTo(Person_1.default, { foreignKey: 'personId', as: 'student' });
// Teacher Availability
Person_1.default.hasMany(TeacherAvailability_1.default, { foreignKey: 'personId', as: 'availability' });
TeacherAvailability_1.default.belongsTo(Person_1.default, { foreignKey: 'personId', as: 'person' });
// Schedules
PeriodGradeSection_1.default.hasOne(Schedule_1.default, { foreignKey: 'periodGradeSectionId', as: 'schedule' });
Schedule_1.default.belongsTo(PeriodGradeSection_1.default, { foreignKey: 'periodGradeSectionId', as: 'section' });
Schedule_1.default.hasMany(ScheduleEntry_1.default, { foreignKey: 'scheduleId', as: 'entries' });
ScheduleEntry_1.default.belongsTo(Schedule_1.default, { foreignKey: 'scheduleId', as: 'schedule' });
ScheduleEntry_1.default.belongsTo(Subject_1.default, { foreignKey: 'subjectId', as: 'subject' });
ScheduleEntry_1.default.belongsTo(Person_1.default, { foreignKey: 'teacherId', as: 'teacher' });
// Schedule exceptions (per-subject overrides for the automatic generator)
ScheduleException_1.default.belongsTo(Subject_1.default, { foreignKey: 'subjectId', as: 'subject' });
Subject_1.default.hasOne(ScheduleException_1.default, { foreignKey: 'subjectId', as: 'scheduleException' });
// Schedule links (cross-grade subject linking for the automatic generator)
ScheduleLink_1.default.belongsTo(SchoolPeriod_1.default, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });
SchoolPeriod_1.default.hasMany(ScheduleLink_1.default, { foreignKey: 'schoolPeriodId', as: 'scheduleLinks' });
ScheduleLink_1.default.hasMany(ScheduleLinkItem_1.default, { foreignKey: 'linkId', as: 'items', onDelete: 'CASCADE' });
ScheduleLinkItem_1.default.belongsTo(ScheduleLink_1.default, { foreignKey: 'linkId', as: 'link' });
ScheduleLinkItem_1.default.belongsTo(Subject_1.default, { foreignKey: 'subjectId', as: 'subject' });
ScheduleLinkItem_1.default.belongsTo(PeriodGrade_1.default, { foreignKey: 'periodGradeId', as: 'periodGrade' });
// Classroom assignments (room <-> section/subject)
ClassroomAssignment_1.default.belongsTo(Subject_1.default, { foreignKey: 'subjectId', as: 'subject' });
// Subject final grades
InscriptionSubject_1.default.hasOne(SubjectFinalGrade_1.default, { foreignKey: 'inscriptionSubjectId', as: 'finalGrade' });
SubjectFinalGrade_1.default.belongsTo(InscriptionSubject_1.default, { foreignKey: 'inscriptionSubjectId', as: 'inscriptionSubject' });
SubjectFinalGrade_1.default.belongsTo(Plantel_1.default, { foreignKey: 'plantelId', as: 'plantel' });
Plantel_1.default.hasMany(SubjectFinalGrade_1.default, { foreignKey: 'plantelId', as: 'finalGrades' });
// Subject term grades (per-lapso scores)
InscriptionSubject_1.default.hasMany(SubjectTermGrade_1.default, { foreignKey: 'inscriptionSubjectId', as: 'termGrades' });
SubjectTermGrade_1.default.belongsTo(InscriptionSubject_1.default, { foreignKey: 'inscriptionSubjectId', as: 'inscriptionSubject' });
SubjectTermGrade_1.default.belongsTo(Term_1.default, { foreignKey: 'termId', as: 'term' });
Term_1.default.hasMany(SubjectTermGrade_1.default, { foreignKey: 'termId', as: 'termGrades' });
// Historical grades (legacy data without InscriptionSubject)
HistoricalGrade_1.default.belongsTo(Person_1.default, { foreignKey: 'personId', as: 'person' });
Person_1.default.hasMany(HistoricalGrade_1.default, { foreignKey: 'personId', as: 'historicalGrades' });
HistoricalGrade_1.default.belongsTo(Grade_1.default, { foreignKey: 'gradeId', as: 'grade' });
HistoricalGrade_1.default.belongsTo(Subject_1.default, { foreignKey: 'subjectId', as: 'subject' });
HistoricalGrade_1.default.belongsTo(SchoolPeriod_1.default, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });
HistoricalGrade_1.default.belongsTo(Plantel_1.default, { foreignKey: 'plantelId', as: 'plantel' });
// Person-Plantel relationship (ordered list of planteles per student)
Person_1.default.belongsToMany(Plantel_1.default, {
    through: PersonPlantel_1.default,
    foreignKey: 'personId',
    otherKey: 'plantelId',
    as: 'planteles',
});
Plantel_1.default.belongsToMany(Person_1.default, {
    through: PersonPlantel_1.default,
    foreignKey: 'plantelId',
    otherKey: 'personId',
    as: 'persons',
});
PersonPlantel_1.default.belongsTo(Person_1.default, { foreignKey: 'personId', as: 'person' });
PersonPlantel_1.default.belongsTo(Plantel_1.default, { foreignKey: 'plantelId', as: 'plantel' });
// Student period outcomes
Inscription_1.default.hasOne(StudentPeriodOutcome_1.default, { foreignKey: 'inscriptionId', as: 'periodOutcome' });
StudentPeriodOutcome_1.default.belongsTo(Inscription_1.default, { foreignKey: 'inscriptionId', as: 'inscription' });
Grade_1.default.hasMany(StudentPeriodOutcome_1.default, { foreignKey: 'promotionGradeId', as: 'incomingStudents' });
StudentPeriodOutcome_1.default.belongsTo(Grade_1.default, { foreignKey: 'promotionGradeId', as: 'promotionGrade' });
// Pending subjects
Inscription_1.default.hasMany(PendingSubject_1.default, { foreignKey: 'newInscriptionId', as: 'pendingSubjects' });
PendingSubject_1.default.belongsTo(Inscription_1.default, { foreignKey: 'newInscriptionId', as: 'inscription' });
Subject_1.default.hasMany(PendingSubject_1.default, { foreignKey: 'subjectId', as: 'pendingAssignments' });
PendingSubject_1.default.belongsTo(Subject_1.default, { foreignKey: 'subjectId', as: 'subject' });
SchoolPeriod_1.default.hasMany(PendingSubject_1.default, { foreignKey: 'originPeriodId', as: 'pendingSubjects' });
PendingSubject_1.default.belongsTo(SchoolPeriod_1.default, { foreignKey: 'originPeriodId', as: 'originPeriod' });
// Pending subject encounters (evaluaciones por encuentro)
PendingSubject_1.default.hasMany(PendingSubjectEncounter_1.default, { foreignKey: 'pendingSubjectId', as: 'encounters' });
PendingSubjectEncounter_1.default.belongsTo(PendingSubject_1.default, { foreignKey: 'pendingSubjectId', as: 'pendingSubject' });
// Pending subject content (Tema General + Contenidos)
PendingSubject_1.default.hasOne(PendingSubjectContent_1.default, { foreignKey: 'pendingSubjectId', as: 'content' });
PendingSubjectContent_1.default.belongsTo(PendingSubject_1.default, { foreignKey: 'pendingSubjectId', as: 'pendingSubject' });
PendingSubjectContent_1.default.hasMany(PendingSubjectContentItem_1.default, { foreignKey: 'contentId', as: 'items' });
PendingSubjectContentItem_1.default.belongsTo(PendingSubjectContent_1.default, { foreignKey: 'contentId', as: 'content' });
// Transition rules
Grade_1.default.hasOne(SchoolPeriodTransitionRule_1.default, { foreignKey: 'gradeFromId', as: 'transitionRule' });
// Revision period associations
SchoolPeriod_1.default.hasOne(RevisionPeriod_1.default, { foreignKey: 'schoolPeriodId', as: 'revisionPeriod' });
RevisionPeriod_1.default.belongsTo(SchoolPeriod_1.default, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });
RevisionPeriod_1.default.hasMany(InscriptionSubjectRevision_1.default, { foreignKey: 'revisionPeriodId', as: 'revisions' });
InscriptionSubjectRevision_1.default.belongsTo(RevisionPeriod_1.default, { foreignKey: 'revisionPeriodId', as: 'revisionPeriod' });
InscriptionSubject_1.default.hasMany(InscriptionSubjectRevision_1.default, { foreignKey: 'inscriptionSubjectId', as: 'revisions' });
InscriptionSubjectRevision_1.default.belongsTo(InscriptionSubject_1.default, { foreignKey: 'inscriptionSubjectId', as: 'inscriptionSubject' });
Person_1.default.hasMany(InscriptionSubjectRevision_1.default, { foreignKey: 'gradedBy', as: 'gradedRevisions' });
InscriptionSubjectRevision_1.default.belongsTo(Person_1.default, { foreignKey: 'gradedBy', as: 'grader' });
// Revision grade edit audits (extraordinary edits by Control de Estudios)
InscriptionSubjectRevision_1.default.hasMany(RevisionGradeEditAudit_1.default, { foreignKey: 'revisionId', as: 'editAudits' });
RevisionGradeEditAudit_1.default.belongsTo(InscriptionSubjectRevision_1.default, { foreignKey: 'revisionId', as: 'revision' });
RevisionGradeEditAudit_1.default.belongsTo(Person_1.default, { foreignKey: 'editedBy', as: 'editor' });
// Revision thematic selections (per subject+section within a revision period)
RevisionPeriod_1.default.hasMany(RevisionThematicSelection_1.default, { foreignKey: 'revisionPeriodId', as: 'thematicSelections' });
RevisionThematicSelection_1.default.belongsTo(RevisionPeriod_1.default, { foreignKey: 'revisionPeriodId', as: 'revisionPeriod' });
PeriodGradeSubject_1.default.hasMany(RevisionThematicSelection_1.default, { foreignKey: 'periodGradeSubjectId', as: 'revisionThematicSelections' });
RevisionThematicSelection_1.default.belongsTo(PeriodGradeSubject_1.default, { foreignKey: 'periodGradeSubjectId', as: 'periodGradeSubject' });
Section_1.default.hasMany(RevisionThematicSelection_1.default, { foreignKey: 'sectionId', as: 'revisionThematicSelections' });
RevisionThematicSelection_1.default.belongsTo(Section_1.default, { foreignKey: 'sectionId', as: 'section' });
// Revision opportunity dates (per subject+section+opportunity within a revision period)
RevisionPeriod_1.default.hasMany(RevisionOpportunityDate_1.default, { foreignKey: 'revisionPeriodId', as: 'opportunityDates' });
RevisionOpportunityDate_1.default.belongsTo(RevisionPeriod_1.default, { foreignKey: 'revisionPeriodId', as: 'revisionPeriod' });
PeriodGradeSubject_1.default.hasMany(RevisionOpportunityDate_1.default, { foreignKey: 'periodGradeSubjectId', as: 'revisionOpportunityDates' });
RevisionOpportunityDate_1.default.belongsTo(PeriodGradeSubject_1.default, { foreignKey: 'periodGradeSubjectId', as: 'periodGradeSubject' });
Section_1.default.hasMany(RevisionOpportunityDate_1.default, { foreignKey: 'sectionId', as: 'revisionOpportunityDates' });
RevisionOpportunityDate_1.default.belongsTo(Section_1.default, { foreignKey: 'sectionId', as: 'section' });
// InscriptionGroupTermChoice — per-term subject choice within a SubjectGroup.
Inscription_1.default.hasMany(InscriptionGroupTermChoice_1.default, { foreignKey: 'inscriptionId', as: 'groupTermChoices' });
InscriptionGroupTermChoice_1.default.belongsTo(Inscription_1.default, { foreignKey: 'inscriptionId', as: 'inscription' });
InscriptionGroupTermChoice_1.default.belongsTo(SubjectGroup_1.default, { foreignKey: 'subjectGroupId', as: 'subjectGroup' });
InscriptionGroupTermChoice_1.default.belongsTo(Subject_1.default, { foreignKey: 'subjectId', as: 'subject' });
InscriptionGroupTermChoice_1.default.belongsTo(Term_1.default, { foreignKey: 'termId', as: 'term' });
SchoolPeriodTransitionRule_1.default.belongsTo(Grade_1.default, { foreignKey: 'gradeFromId', as: 'gradeFrom' });
Grade_1.default.hasMany(SchoolPeriodTransitionRule_1.default, { foreignKey: 'gradeToId', as: 'incomingTransitions' });
SchoolPeriodTransitionRule_1.default.belongsTo(Grade_1.default, { foreignKey: 'gradeToId', as: 'gradeTo' });
// Grade edit permission associations
SchoolPeriod_1.default.hasMany(GradeEditPermission_1.default, { foreignKey: 'schoolPeriodId', as: 'editPermissions' });
GradeEditPermission_1.default.belongsTo(SchoolPeriod_1.default, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });
User_1.default.hasMany(GradeEditPermission_1.default, { foreignKey: 'grantedBy', as: 'grantedPermissions' });
GradeEditPermission_1.default.belongsTo(User_1.default, { foreignKey: 'grantedBy', as: 'granter' });
User_1.default.hasMany(GradeEditPermission_1.default, { foreignKey: 'grantedTo', as: 'receivedPermissions' });
GradeEditPermission_1.default.belongsTo(User_1.default, { foreignKey: 'grantedTo', as: 'recipient' });
User_1.default.hasMany(GradeEditPermission_1.default, { foreignKey: 'revokedBy', as: 'revokedPermissions' });
GradeEditPermission_1.default.belongsTo(User_1.default, { foreignKey: 'revokedBy', as: 'revoker' });
// Grade edit audit associations
SubjectFinalGrade_1.default.hasMany(GradeEditAudit_1.default, { foreignKey: 'subjectFinalGradeId', as: 'editAudits' });
GradeEditAudit_1.default.belongsTo(SubjectFinalGrade_1.default, { foreignKey: 'subjectFinalGradeId', as: 'subjectFinalGrade' });
GradeEditPermission_1.default.hasMany(GradeEditAudit_1.default, { foreignKey: 'permissionId', as: 'audits' });
GradeEditAudit_1.default.belongsTo(GradeEditPermission_1.default, { foreignKey: 'permissionId', as: 'permission' });
User_1.default.hasMany(GradeEditAudit_1.default, { foreignKey: 'editedBy', as: 'gradeEdits' });
GradeEditAudit_1.default.belongsTo(User_1.default, { foreignKey: 'editedBy', as: 'editor' });
// Qualification audit associations
Qualification_1.default.hasMany(QualificationAudit_1.default, { foreignKey: 'qualificationId', as: 'audits' });
QualificationAudit_1.default.belongsTo(Qualification_1.default, { foreignKey: 'qualificationId', as: 'qualification' });
User_1.default.hasMany(QualificationAudit_1.default, { foreignKey: 'editedBy', as: 'qualificationEdits' });
QualificationAudit_1.default.belongsTo(User_1.default, { foreignKey: 'editedBy', as: 'editor' });
// Enrollment reports
EnrollmentReport_1.default.belongsTo(Matriculation_1.default, { foreignKey: 'matriculationId', as: 'matriculation' });
Matriculation_1.default.hasMany(EnrollmentReport_1.default, { foreignKey: 'matriculationId', as: 'enrollmentReports' });
EnrollmentReport_1.default.belongsTo(Person_1.default, { foreignKey: 'personId', as: 'student' });
Person_1.default.hasMany(EnrollmentReport_1.default, { foreignKey: 'personId', as: 'enrollmentReports' });
// ── Payments module ──────────────────────────────────────────────
// ExchangeRateType <-> ExchangeRate
ExchangeRateType_1.default.hasMany(ExchangeRate_1.default, { foreignKey: 'exchangeRateTypeId', as: 'rates' });
ExchangeRate_1.default.belongsTo(ExchangeRateType_1.default, { foreignKey: 'exchangeRateTypeId', as: 'type' });
// ExchangeRateType <-> Fee
ExchangeRateType_1.default.hasMany(Fee_1.default, { foreignKey: 'exchangeRateTypeId', as: 'fees' });
Fee_1.default.belongsTo(ExchangeRateType_1.default, { foreignKey: 'exchangeRateTypeId', as: 'exchangeRateType' });
// SchoolPeriod <-> Fee
SchoolPeriod_1.default.hasMany(Fee_1.default, { foreignKey: 'schoolPeriodId', as: 'fees' });
Fee_1.default.belongsTo(SchoolPeriod_1.default, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });
// ExchangeRateType <-> SellableItem
ExchangeRateType_1.default.hasMany(SellableItem_1.default, { foreignKey: 'exchangeRateTypeId', as: 'sellableItems' });
SellableItem_1.default.belongsTo(ExchangeRateType_1.default, { foreignKey: 'exchangeRateTypeId', as: 'exchangeRateType' });
// ExchangeRateType <-> EnrollmentPlan (target currency)
ExchangeRateType_1.default.hasMany(EnrollmentPlan_1.default, { foreignKey: 'targetExchangeRateTypeId', as: 'enrollmentPlans' });
EnrollmentPlan_1.default.belongsTo(ExchangeRateType_1.default, { foreignKey: 'targetExchangeRateTypeId', as: 'targetExchangeRateType' });
// EnrollmentPlan <-> EnrollmentPlanItem
EnrollmentPlan_1.default.hasMany(EnrollmentPlanItem_1.default, { foreignKey: 'enrollmentPlanId', as: 'items' });
EnrollmentPlanItem_1.default.belongsTo(EnrollmentPlan_1.default, { foreignKey: 'enrollmentPlanId', as: 'plan' });
// EnrollmentPlan <-> SchoolPeriod
SchoolPeriod_1.default.hasMany(EnrollmentPlan_1.default, { foreignKey: 'schoolPeriodId', as: 'enrollmentPlans' });
EnrollmentPlan_1.default.belongsTo(SchoolPeriod_1.default, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });
// EnrollmentPlanItem <-> Fee
Fee_1.default.hasMany(EnrollmentPlanItem_1.default, { foreignKey: 'feeId', as: 'planItems' });
EnrollmentPlanItem_1.default.belongsTo(Fee_1.default, { foreignKey: 'feeId', as: 'fee' });
// EnrollmentPlanItem <-> SellableItem
SellableItem_1.default.hasMany(EnrollmentPlanItem_1.default, { foreignKey: 'sellableItemId', as: 'planItems' });
EnrollmentPlanItem_1.default.belongsTo(SellableItem_1.default, { foreignKey: 'sellableItemId', as: 'sellableItem' });
// ── Ledger: Payment & Charge ──
// Inscription <-> Charge (one student can have many charges in a period)
Inscription_1.default.hasMany(Charge_1.default, { foreignKey: 'inscriptionId', as: 'charges' });
Charge_1.default.belongsTo(Inscription_1.default, { foreignKey: 'inscriptionId', as: 'inscription' });
// Inscription <-> Payment
Inscription_1.default.hasMany(Payment_1.default, { foreignKey: 'inscriptionId', as: 'payments' });
Payment_1.default.belongsTo(Inscription_1.default, { foreignKey: 'inscriptionId', as: 'inscription' });
// SchoolPeriod <-> Charge
SchoolPeriod_1.default.hasMany(Charge_1.default, { foreignKey: 'schoolPeriodId', as: 'charges' });
Charge_1.default.belongsTo(SchoolPeriod_1.default, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });
// SchoolPeriod <-> Payment
SchoolPeriod_1.default.hasMany(Payment_1.default, { foreignKey: 'schoolPeriodId', as: 'payments' });
Payment_1.default.belongsTo(SchoolPeriod_1.default, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });
// Charge <-> Payment (a charge can be settled by multiple payments)
Charge_1.default.hasMany(Payment_1.default, { foreignKey: 'chargeId', as: 'payments' });
Payment_1.default.belongsTo(Charge_1.default, { foreignKey: 'chargeId', as: 'charge' });
// Fee <-> Charge (optional link)
Fee_1.default.hasMany(Charge_1.default, { foreignKey: 'feeId', as: 'charges' });
Charge_1.default.belongsTo(Fee_1.default, { foreignKey: 'feeId', as: 'fee' });
// Fee <-> Payment (optional link)
Fee_1.default.hasMany(Payment_1.default, { foreignKey: 'feeId', as: 'payments' });
Payment_1.default.belongsTo(Fee_1.default, { foreignKey: 'feeId', as: 'fee' });
// SellableItem <-> Charge
SellableItem_1.default.hasMany(Charge_1.default, { foreignKey: 'sellableItemId', as: 'charges' });
Charge_1.default.belongsTo(SellableItem_1.default, { foreignKey: 'sellableItemId', as: 'sellableItem' });
// SellableItem <-> Payment
SellableItem_1.default.hasMany(Payment_1.default, { foreignKey: 'sellableItemId', as: 'payments' });
Payment_1.default.belongsTo(SellableItem_1.default, { foreignKey: 'sellableItemId', as: 'sellableItem' });
// Grade change log (unified audit trail)
GradeChangeLog_1.default.belongsTo(User_1.default, { foreignKey: 'editedBy', as: 'editor' });
User_1.default.hasMany(GradeChangeLog_1.default, { foreignKey: 'editedBy', as: 'gradeChanges' });
// Qualification edit request (teacher requests permission to edit timer-locked grade)
QualificationEditRequest_1.default.belongsTo(Qualification_1.default, { foreignKey: 'qualificationId', as: 'qualification' });
Qualification_1.default.hasMany(QualificationEditRequest_1.default, { foreignKey: 'qualificationId', as: 'editRequests' });
QualificationEditRequest_1.default.belongsTo(User_1.default, { foreignKey: 'requestedBy', as: 'requester' });
User_1.default.hasMany(QualificationEditRequest_1.default, { foreignKey: 'requestedBy', as: 'editRequestsMade' });
QualificationEditRequest_1.default.belongsTo(User_1.default, { foreignKey: 'reviewedBy', as: 'reviewer' });
User_1.default.hasMany(QualificationEditRequest_1.default, { foreignKey: 'reviewedBy', as: 'editRequestsReviewed' });
// ── Attendance module ─────────────────────────────────────────────
// Sessions derive from ScheduleEntry + calendar date (on-demand, backfill OK)
ScheduleEntry_1.default.hasMany(AttendanceSession_1.default, { foreignKey: 'scheduleEntryId', as: 'attendanceSessions' });
AttendanceSession_1.default.belongsTo(ScheduleEntry_1.default, { foreignKey: 'scheduleEntryId', as: 'scheduleEntry' });
SchoolPeriod_1.default.hasMany(AttendanceSession_1.default, { foreignKey: 'schoolPeriodId', as: 'attendanceSessions' });
AttendanceSession_1.default.belongsTo(SchoolPeriod_1.default, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });
AttendanceSession_1.default.hasMany(AttendanceRecord_1.default, { foreignKey: 'sessionId', as: 'records' });
AttendanceRecord_1.default.belongsTo(AttendanceSession_1.default, { foreignKey: 'sessionId', as: 'session' });
Inscription_1.default.hasMany(AttendanceRecord_1.default, { foreignKey: 'inscriptionId', as: 'attendanceRecords' });
AttendanceRecord_1.default.belongsTo(Inscription_1.default, { foreignKey: 'inscriptionId', as: 'inscription' });
Person_1.default.hasMany(AttendanceRecord_1.default, { foreignKey: 'teacherId', as: 'markedAttendanceRecords' });
AttendanceRecord_1.default.belongsTo(Person_1.default, { foreignKey: 'teacherId', as: 'teacher' });
Person_1.default.hasMany(AttendanceRecord_1.default, { foreignKey: 'clearedBy', as: 'clearedAttendanceRecords' });
AttendanceRecord_1.default.belongsTo(Person_1.default, { foreignKey: 'clearedBy', as: 'clearedByPerson' });
// Append-only audit trail
AttendanceRecord_1.default.hasMany(AttendanceAuditLog_1.default, { foreignKey: 'attendanceRecordId', as: 'auditLogs' });
AttendanceAuditLog_1.default.belongsTo(AttendanceRecord_1.default, { foreignKey: 'attendanceRecordId', as: 'attendanceRecord' });
Person_1.default.hasMany(AttendanceAuditLog_1.default, { foreignKey: 'performedBy', as: 'attendanceAuditEntries' });
AttendanceAuditLog_1.default.belongsTo(Person_1.default, { foreignKey: 'performedBy', as: 'performer' });
// ── Gate check-in (RFID foundation — hardware not deployed yet) ──
Person_1.default.hasMany(IdCard_1.default, { foreignKey: 'personId', as: 'idCards' });
IdCard_1.default.belongsTo(Person_1.default, { foreignKey: 'personId', as: 'person' });
GateDevice_1.default.hasMany(GateCheckin_1.default, { foreignKey: 'deviceId', as: 'checkins' });
GateCheckin_1.default.belongsTo(GateDevice_1.default, { foreignKey: 'deviceId', as: 'device' });
Person_1.default.hasMany(GateCheckin_1.default, { foreignKey: 'personId', as: 'gateCheckins' });
GateCheckin_1.default.belongsTo(Person_1.default, { foreignKey: 'personId', as: 'person' });
