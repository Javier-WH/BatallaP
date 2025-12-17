import User from './User';
import Person from './Person';
import Role from './Role';
import PersonRole from './PersonRole';
import Contact from './Contact';

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
import PeriodGradeSubject from './PeriodGradeSubject';

// ... (Existing User/Person/Role/Contact associations) ...

// Educational Structure Associations

// 1. SchoolPeriod <-> Grade
SchoolPeriod.belongsToMany(Grade, { through: PeriodGrade, foreignKey: 'schoolPeriodId', otherKey: 'gradeId', as: 'grades' });
Grade.belongsToMany(SchoolPeriod, { through: PeriodGrade, foreignKey: 'gradeId', otherKey: 'schoolPeriodId', as: 'periods' });
PeriodGrade.belongsTo(SchoolPeriod, { foreignKey: 'schoolPeriodId', as: 'schoolPeriod' });
PeriodGrade.belongsTo(Grade, { foreignKey: 'gradeId', as: 'grade' });

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

export {
  User,
  Person,
  Role,
  PersonRole,
  Contact,
  SchoolPeriod,
  Grade,
  Section,
  PeriodGrade,
  PeriodGradeSection,
  Subject,
  PeriodGradeSubject
};
