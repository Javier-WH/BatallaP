import request from 'supertest';
import app from '@/app';
import {
  createTestUser,
  createTestRole,
  createAcademicStructure,
  createTestInscription,
} from '../helpers/testData';
import { InscriptionSubject, Matriculation, PersonRole } from '@/models/index';

describe('GET /api/dashboard/admin-inconsistencies', () => {
  let agent: any;
  let structure: any;

  const makeStudent = async (name: string) => {
    const { person } = await createTestUser({ username: `stu-${name}`, firstName: name, lastName: 'Apellido' });
    const alumnoRole = await createTestRole('Alumno');
    await PersonRole.create({ personId: person.id, roleId: alumnoRole.id });
    return person;
  };

  beforeEach(async () => {
    agent = request.agent(app);

    const { person: admin } = await createTestUser({ username: 'admin' });
    const adminRole = await createTestRole('Administrador');
    await PersonRole.create({ personId: admin.id, roleId: adminRole.id });

    await agent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password123' });

    structure = await createAcademicStructure();
  });

  it('lists the students behind each inconsistency count', async () => {
    const { period, grade, section, subject } = structure;

    // Student with a pending matriculation and a section-less inscription.
    const noSection = await makeStudent('SinSeccion');
    const insNoSection = await createTestInscription(noSection.id, period.id, grade.id, null as any);
    await Matriculation.create({
      schoolPeriodId: period.id,
      gradeId: grade.id,
      personId: noSection.id,
      inscriptionId: insNoSection.id,
      status: 'pending',
      escolaridad: 'regular',
    });

    // Student with a section but no subjects.
    const noSubjects = await makeStudent('SinMaterias');
    const insNoSubjects = await createTestInscription(noSubjects.id, period.id, grade.id, section.id);
    await Matriculation.create({
      schoolPeriodId: period.id,
      gradeId: grade.id,
      sectionId: section.id,
      personId: noSubjects.id,
      inscriptionId: insNoSubjects.id,
      status: 'completed',
      escolaridad: 'regular',
    });

    // Healthy student: section + at least one subject.
    const ok = await makeStudent('Correcto');
    const insOk = await createTestInscription(ok.id, period.id, grade.id, section.id);
    await InscriptionSubject.create({
      inscriptionId: insOk.id,
      subjectId: subject.id,
      schoolPeriodId: period.id,
      gradeId: grade.id,
      sectionId: section.id,
    });

    const res = await agent
      .get('/api/dashboard/admin-inconsistencies')
      .query({ schoolPeriodId: period.id });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.withoutSection)).toBe(true);
    expect(Array.isArray(res.body.withoutSubjects)).toBe(true);

    const noSectionIds = res.body.withoutSection.map((s: any) => s.personId);
    expect(noSectionIds).toContain(noSection.id);
    expect(noSectionIds).not.toContain(noSubjects.id);
    expect(noSectionIds).not.toContain(ok.id);

    const noSubjectsIds = res.body.withoutSubjects.map((s: any) => s.personId);
    expect(noSubjectsIds).toContain(noSubjects.id);
    expect(noSubjectsIds).not.toContain(noSection.id);
    expect(noSubjectsIds).not.toContain(ok.id);

    const noSectionRow = res.body.withoutSection.find((s: any) => s.personId === noSection.id);
    expect(noSectionRow.lastName).toBe('APELLIDO');
    expect(noSectionRow.documentType).toBe('Venezolano');
    expect(noSectionRow.gradeName).toBe(grade.name);
    expect(noSectionRow.matriculationStatus).toBe('pending');

    const noSubjectsRow = res.body.withoutSubjects.find((s: any) => s.personId === noSubjects.id);
    expect(noSubjectsRow.gradeName).toBe(grade.name);
    expect(noSubjectsRow.sectionName).toBe(section.name);
  });

  it('defaults to the active period when schoolPeriodId is omitted', async () => {
    const res = await agent.get('/api/dashboard/admin-inconsistencies');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('withoutSection');
    expect(res.body).toHaveProperty('withoutSubjects');
  });
});
