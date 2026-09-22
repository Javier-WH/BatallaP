import request from 'supertest';
import app from '@/app';
import { createTestUser, createAcademicStructure, createTestSubject, createTestTerm, createTestSetting } from '../helpers/testData';
import { ConstanciaTemplate, Person, Matriculation, Inscription, InscriptionSubject, SubjectFinalGrade, SubjectTermGrade, CouncilChecklist, PeriodGradeSubject } from '@/models/index';

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

  // ── subject.N.* numbered variables ──

  it('resolves numbered subject variables (name, term score, final, status) when council is done', async () => {
    const { period, grade, section, subject } = await createAcademicStructure();
    const term = await createTestTerm(period.id, { order: 1 });
    const { person } = await createTestUser({ username: 'student5' });
    const inscription = await Inscription.create({
      personId: person.id,
      schoolPeriodId: period.id,
      gradeId: grade.id,
      sectionId: section.id,
      escolaridad: 'regular',
    });
    const insSub = await InscriptionSubject.create({
      inscriptionId: inscription.id,
      subjectId: subject.id,
      schoolPeriodId: period.id,
      gradeId: grade.id,
      sectionId: section.id,
    });
    await SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: term.id, score: 15 });
    await SubjectFinalGrade.create({ inscriptionSubjectId: insSub.id, finalScore: 15, status: 'aprobada' });
    await CouncilChecklist.create({
      schoolPeriodId: period.id, gradeId: grade.id, sectionId: section.id,
      termId: term.id, status: 'done',
    });

    const template = await ConstanciaTemplate.create({
      name: 'Constancia notas',
      content: '<p>{{subject.1.name}}|{{subject.1.term.1.score}}|{{subject.1.score}}|{{subject.1.scoreWords}}|{{subject.1.status}}</p>',
    } as any);

    const res = await agent
      .post('/api/constancias/preview')
      .send({ templateId: template.id, personId: person.id, schoolPeriodId: period.id })
      .expect(200);

    expect(res.body.variables['subject.1.name']).toBe(subject.name);
    expect(res.body.variables['subject.1.term.1.score']).toBe('15');
    expect(res.body.variables['subject.1.score']).toBe('15');
    expect(res.body.variables['subject.1.scoreWords']).toBe('quince');
    expect(res.body.variables['subject.1.status']).toBe('aprobada');
  });

  it('leaves term and final scores empty when the council is not done', async () => {
    const { period, grade, section, subject } = await createAcademicStructure();
    const term = await createTestTerm(period.id, { order: 1 });
    const { person } = await createTestUser({ username: 'student6' });
    const inscription = await Inscription.create({
      personId: person.id,
      schoolPeriodId: period.id,
      gradeId: grade.id,
      sectionId: section.id,
      escolaridad: 'regular',
    });
    const insSub = await InscriptionSubject.create({
      inscriptionId: inscription.id,
      subjectId: subject.id,
      schoolPeriodId: period.id,
      gradeId: grade.id,
      sectionId: section.id,
    });
    await SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: term.id, score: 15 });
    // Guard: no CouncilChecklist for this term/section
    expect(await CouncilChecklist.count({ where: { schoolPeriodId: period.id } })).toBe(0);

    const template = await ConstanciaTemplate.create({
      name: 'Constancia sin consejo',
      content: '<p>{{subject.1.name}}|{{subject.1.term.1.score}}|{{subject.1.score}}</p>',
    } as any);

    const res = await agent
      .post('/api/constancias/preview')
      .send({ templateId: template.id, personId: person.id, schoolPeriodId: period.id })
      .expect(200);

    expect(res.body.variables['subject.1.name']).toBe(subject.name);
    expect(res.body.variables['subject.1.term.1.score']).toBe('');
    expect(res.body.variables['subject.1.score']).toBe('');
  });

  it('renders literal subject scores as letters using the letter_grades scale', async () => {
    const { period, grade, section, subject } = await createAcademicStructure();
    await subject.update({ usesLiteralGrades: true });
    await createTestSetting('letter_grades', JSON.stringify([
      { letter: 'A', max: 20 }, { letter: 'B', max: 16 },
      { letter: 'C', max: 12 }, { letter: 'D', max: 9 },
    ]));
    const term = await createTestTerm(period.id, { order: 1 });
    const { person } = await createTestUser({ username: 'student7' });
    const inscription = await Inscription.create({
      personId: person.id,
      schoolPeriodId: period.id,
      gradeId: grade.id,
      sectionId: section.id,
      escolaridad: 'regular',
    });
    const insSub = await InscriptionSubject.create({
      inscriptionId: inscription.id,
      subjectId: subject.id,
      schoolPeriodId: period.id,
      gradeId: grade.id,
      sectionId: section.id,
    });
    await SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: term.id, score: 18 });
    await SubjectFinalGrade.create({ inscriptionSubjectId: insSub.id, finalScore: 18, status: 'aprobada' });
    await CouncilChecklist.create({
      schoolPeriodId: period.id, gradeId: grade.id, sectionId: section.id,
      termId: term.id, status: 'done',
    });

    const template = await ConstanciaTemplate.create({
      name: 'Constancia literal',
      content: '<p>{{subject.1.score}}|{{subject.1.term.1.score}}|{{subject.1.scoreWords}}</p>',
    } as any);

    const res = await agent
      .post('/api/constancias/preview')
      .send({ templateId: template.id, personId: person.id, schoolPeriodId: period.id })
      .expect(200);

    expect(res.body.variables['subject.1.score']).toBe('A');
    expect(res.body.variables['subject.1.term.1.score']).toBe('A');
    expect(res.body.variables['subject.1.scoreWords']).toBe('');
  });

  it('numbers subjects by canonical PeriodGradeSubject.order, not alphabetically', async () => {
    const { period, grade, section, subject, periodGrade, periodGradeSubject } = await createAcademicStructure();
    const subject2 = await createTestSubject({ name: 'Castellano' });
    // subject2 gets canonical position 1; the structure's subject gets 2
    await PeriodGradeSubject.create({ periodGradeId: periodGrade.id, subjectId: subject2.id, order: 1 });
    await periodGradeSubject.update({ order: 2 });

    const { person } = await createTestUser({ username: 'student8' });
    const inscription = await Inscription.create({
      personId: person.id,
      schoolPeriodId: period.id,
      gradeId: grade.id,
      sectionId: section.id,
      escolaridad: 'regular',
    });
    await InscriptionSubject.create({ inscriptionId: inscription.id, subjectId: subject.id });
    await InscriptionSubject.create({ inscriptionId: inscription.id, subjectId: subject2.id });

    const template = await ConstanciaTemplate.create({
      name: 'Constancia orden',
      content: '<p>{{subject.1.name}}|{{subject.2.name}}</p>',
    } as any);

    const res = await agent
      .post('/api/constancias/preview')
      .send({ templateId: template.id, personId: person.id, schoolPeriodId: period.id })
      .expect(200);

    expect(res.body.variables['subject.1.name']).toBe(subject2.name);
    expect(res.body.variables['subject.2.name']).toBe(subject.name);
  });

  it('resolves subject names from the grade plan for a matriculated (not enrolled) student', async () => {
    const { period, grade, section, subject } = await createAcademicStructure();
    const { person } = await createTestUser({ username: 'student9' });
    await Matriculation.create({
      personId: person.id,
      schoolPeriodId: period.id,
      gradeId: grade.id,
      sectionId: section.id,
      status: 'pending',
    });
    expect(await Inscription.count({ where: { personId: person.id } })).toBe(0);

    const template = await ConstanciaTemplate.create({
      name: 'Constancia plan',
      content: '<p>{{subject.1.name}}|{{subject.1.score}}</p>',
    } as any);

    const res = await agent
      .post('/api/constancias/preview')
      .send({ templateId: template.id, personId: person.id, schoolPeriodId: period.id })
      .expect(200);

    expect(res.body.variables['subject.1.name']).toBe(subject.name);
    expect(res.body.variables['subject.1.score']).toBe('');
  });

  it('resolves term and final scores in a historical period without council checklists', async () => {
    const { period, grade, section, subject } = await createAcademicStructure({
      period: { status: 'historico' },
    });
    const term = await createTestTerm(period.id, { order: 1 });
    const { person } = await createTestUser({ username: 'student10' });
    const inscription = await Inscription.create({
      personId: person.id,
      schoolPeriodId: period.id,
      gradeId: grade.id,
      sectionId: section.id,
      escolaridad: 'regular',
    });
    const insSub = await InscriptionSubject.create({
      inscriptionId: inscription.id,
      subjectId: subject.id,
      schoolPeriodId: period.id,
      gradeId: grade.id,
      sectionId: section.id,
    });
    await SubjectTermGrade.create({ inscriptionSubjectId: insSub.id, termId: term.id, score: 16 });
    await SubjectFinalGrade.create({ inscriptionSubjectId: insSub.id, finalScore: 16, status: 'aprobada' });
    // Guard: historical data may lack checklist records entirely
    expect(await CouncilChecklist.count({ where: { schoolPeriodId: period.id } })).toBe(0);

    const template = await ConstanciaTemplate.create({
      name: 'Constancia culminación',
      content: '<p>{{period.name}}|{{subject.1.term.1.score}}|{{subject.1.score}}|{{subject.1.status}}</p>',
    } as any);

    const res = await agent
      .post('/api/constancias/preview')
      .send({ templateId: template.id, personId: person.id, schoolPeriodId: period.id })
      .expect(200);

    expect(res.body.variables['period.name']).toBe(period.name);
    expect(res.body.variables['subject.1.term.1.score']).toBe('16');
    expect(res.body.variables['subject.1.score']).toBe('16');
    expect(res.body.variables['subject.1.status']).toBe('aprobada');
  });
});
