import request from 'supertest';
import app from '@/app';
import { createTestUser, createAcademicStructure } from '../helpers/testData';
import { ConstanciaTemplate, Person, Matriculation, Inscription } from '@/models/index';

// Constancia variable resolution: grade.* and section.* must resolve even when
// the student is not yet formally enrolled (no Inscription) — the info lives in
// their Matriculation record.
describe('Constancia preview - academic variables', () => {
  let agent: any;

  beforeEach(async () => {
    agent = request.agent(app);
    await createTestUser({ username: 'admin' });
    await agent
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'password123' });
  });

  it('resolves grade/section variables for a non-enrolled student via Matriculation', async () => {
    const { period, grade, section } = await createAcademicStructure();
    await grade.update({ order: 3 });
    const { person } = await createTestUser({ username: 'student1' });

    await Matriculation.create({
      personId: person.id,
      schoolPeriodId: period.id,
      gradeId: grade.id,
      sectionId: section.id,
      status: 'pending',
    });
    // Guard: this student has NO inscription
    expect(await Inscription.count({ where: { personId: person.id } })).toBe(0);

    const template = await ConstanciaTemplate.create({
      name: 'Constancia de estudio',
      content: '<p>El estudiante cursa {{grade.fullName}} sección {{section.name}} ({{grade.ordinal}})</p>',
    } as any);

    const res = await agent
      .post('/api/constancias/preview')
      .send({ templateId: template.id, personId: person.id, schoolPeriodId: period.id })
      .expect(200);

    expect(res.body.variables['grade.fullName']).toBe(grade.name);
    expect(res.body.variables['section.name']).toBe(section.name);
    expect(res.body.variables['grade.ordinal']).toBe('3er');
    expect(res.body.html).toContain(grade.name);
    expect(res.body.html).toContain(section.name);
  });

  it('still resolves grade/section from Inscription when the student is enrolled', async () => {
    const { period, grade, section } = await createAcademicStructure();
    const { person } = await createTestUser({ username: 'student2' });

    await Inscription.create({
      personId: person.id,
      schoolPeriodId: period.id,
      gradeId: grade.id,
      sectionId: section.id,
      escolaridad: 'regular',
    });

    const template = await ConstanciaTemplate.create({
      name: 'Constancia inscrito',
      content: '<p>{{grade.fullName}} - {{section.name}}</p>',
    } as any);

    const res = await agent
      .post('/api/constancias/preview')
      .send({ templateId: template.id, personId: person.id, schoolPeriodId: period.id })
      .expect(200);

    expect(res.body.variables['grade.fullName']).toBe(grade.name);
    expect(res.body.variables['section.name']).toBe(section.name);
  });

  it('leaves grade/section empty when the student has neither Inscription nor Matriculation', async () => {
    const { period } = await createAcademicStructure();
    const { person } = await createTestUser({ username: 'student3' });

    const template = await ConstanciaTemplate.create({
      name: 'Constancia vacía',
      content: '<p>{{grade.fullName}} - {{section.name}}</p>',
    } as any);

    const res = await agent
      .post('/api/constancias/preview')
      .send({ templateId: template.id, personId: person.id, schoolPeriodId: period.id })
      .expect(200);

    expect(res.body.variables['grade.fullName']).toBe('');
    expect(res.body.variables['section.name']).toBe('');
  });

  it('does not leak a matriculation from another period', async () => {
    const { period } = await createAcademicStructure();
    const other = await createAcademicStructure();
    const { person } = await createTestUser({ username: 'student4' });

    // Matriculation belongs to the OTHER period — should not apply here
    await Matriculation.create({
      personId: person.id,
      schoolPeriodId: other.period.id,
      gradeId: other.grade.id,
      sectionId: other.section.id,
      status: 'pending',
    });

    const template = await ConstanciaTemplate.create({
      name: 'Constancia período',
      content: '<p>{{grade.fullName}}</p>',
    } as any);

    const res = await agent
      .post('/api/constancias/preview')
      .send({ templateId: template.id, personId: person.id, schoolPeriodId: period.id })
      .expect(200);

    expect(res.body.variables['grade.fullName']).toBe('');
  });
});
