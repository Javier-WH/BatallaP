import request from 'supertest';
import app from '@/app';
import {
  createTestUser, createTestRole, createAcademicStructure, createTestInscription, createTestTerm, createTestSection,
} from '../helpers/testData';
import { PersonRole, InscriptionSubject, TeacherAssignment, PeriodGradeSection, Inscription } from '@/models/index';
import { alignSubjectSections } from '@/services/inscriptionSubjectSectionService';

/**
 * A student that changes section must show up in the grade list of the new section
 * (and leave the old one): the list reads the marks through the subject's own section,
 * so that column has to follow the inscription.
 */
describe('Grade lists follow a student that changes section', () => {
  let agent: any;
  let structure: any;
  let sectionB: any;
  let term: any;
  let assignmentA: any;
  let assignmentB: any;
  let inscriptionId: number;
  let subjectRowId: number;

  const listFor = async (assignment: any) => {
    const res = await agent.get(`/api/evaluation/students/${assignment.id}?termId=${term.id}`).expect(200);
    return res.body.map((e: any) => e.id);
  };

  beforeEach(async () => {
    agent = request.agent(app);
    const { person } = await createTestUser({ username: 'admin' });
    await PersonRole.create({ personId: person.id, roleId: (await createTestRole('Master')).id });
    await agent.post('/api/auth/login').send({ username: 'admin', password: 'password123' });

    structure = await createAcademicStructure();
    term = await createTestTerm(structure.period.id, { name: 'Primer Lapso', order: 1, isActive: true });
    sectionB = await createTestSection({ name: 'B' });
    await PeriodGradeSection.create({ periodGradeId: structure.periodGrade.id, sectionId: sectionB.id });

    const { person: teacher } = await createTestUser({ username: 'teacher' });
    assignmentA = await TeacherAssignment.create({
      teacherId: teacher.id, periodGradeSubjectId: structure.periodGradeSubject.id, sectionId: structure.section.id,
    });
    assignmentB = await TeacherAssignment.create({
      teacherId: teacher.id, periodGradeSubjectId: structure.periodGradeSubject.id, sectionId: sectionB.id,
    });

    const { person: kid } = await createTestUser({ username: 'kid', firstName: 'Ana', lastName: 'Zapata' });
    await PersonRole.create({ personId: kid.id, roleId: (await createTestRole('Alumno')).id });
    const inscription = await createTestInscription(kid.id, structure.period.id, structure.grade.id, structure.section.id);
    inscriptionId = inscription.id;
    const row = await InscriptionSubject.create({
      inscriptionId, subjectId: structure.subject.id, schoolPeriodId: structure.period.id,
      gradeId: structure.grade.id, sectionId: structure.section.id,
    });
    subjectRowId = row.id;
  });

  it('moves the student from one list to the other when his section is edited', async () => {
    expect(await listFor(assignmentA)).toEqual([inscriptionId]);
    expect(await listFor(assignmentB)).toEqual([]);

    await agent.put(`/api/inscriptions/${inscriptionId}`).send({ sectionId: sectionB.id }).expect(200);

    expect((await InscriptionSubject.findByPk(subjectRowId))!.sectionId).toBe(sectionB.id);
    expect(await listFor(assignmentB)).toEqual([inscriptionId]);
    expect(await listFor(assignmentA)).toEqual([]);
  });

  it('lists a student whose subjects were left in the old section (data already out of step)', async () => {
    await Inscription.update({ sectionId: sectionB.id }, { where: { id: inscriptionId } });
    expect((await InscriptionSubject.findByPk(subjectRowId))!.sectionId).toBe(structure.section.id);

    expect(await listFor(assignmentB)).toEqual([inscriptionId]);
    expect(await listFor(assignmentA)).toEqual([]);
  });

  it('exposes the roster number so the list can show it', async () => {
    await Inscription.update({ rosterNumber: 7 }, { where: { id: inscriptionId } });
    const res = await agent.get(`/api/evaluation/students/${assignmentA.id}?termId=${term.id}`).expect(200);
    expect(res.body[0].rosterNumber).toBe(7);
  });

  describe('alignSubjectSections', () => {
    it('only touches active inscriptions with a section, and can be repeated', async () => {
      await Inscription.update({ sectionId: sectionB.id }, { where: { id: inscriptionId } });
      expect(await alignSubjectSections()).toBe(1);
      expect(await alignSubjectSections()).toBe(0);

      // Withdrawn: no section on the inscription, the subjects keep where they were taken.
      await Inscription.update({ sectionId: null, withdrawnAt: new Date() } as any, { where: { id: inscriptionId } });
      expect(await alignSubjectSections()).toBe(0);
      expect((await InscriptionSubject.findByPk(subjectRowId))!.sectionId).toBe(sectionB.id);
    });
  });
});
