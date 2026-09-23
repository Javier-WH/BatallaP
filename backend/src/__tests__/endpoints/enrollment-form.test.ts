import request from 'supertest';
import app from '@/app';
import { createAcademicStructure, createTestUser, createTestRole } from '../helpers/testData';
import {
  Person,
  Contact,
  PersonResidence,
  Inscription,
  Matriculation,
  StudentGuardian,
  GuardianProfile,
  PersonRole,
} from '@/models/index';

describe('Enrollment Form - Data Type Validation', () => {
  let agent: any;
  let docCounter = 90000000; // Unique doc per test to avoid conflicts

  beforeEach(async () => {
    agent = request.agent(app);
    const { person: adminPerson } = await createTestUser({ username: 'admin_enroll', document: String(++docCounter) });
    // registerAndEnroll requires an enrollment-capable role (Master/Admin).
    const adminRole = await createTestRole('Administrador');
    await PersonRole.create({ personId: adminPerson.id, roleId: adminRole.id });
    await agent
      .post('/api/auth/login')
      .send({ username: 'admin_enroll', password: 'password123' });
  });

  const createEnrollmentPayload = (structure: any, overrides: Partial<any> = {}) => ({
    firstName: 'Juan',
    lastName: 'Pérez',
    documentType: 'Venezolano',
    document: String(++docCounter),
    gender: 'M',
    birthdate: '2010-05-15',
    pathology: 'Asma',
    livingWith: 'ambos_padres',
    birthState: 'Distrito Capital',
    birthMunicipality: 'Libertador',
    birthParish: 'Catedral',
    residenceState: 'Distrito Capital',
    residenceMunicipality: 'Libertador',
    residenceParish: 'Catedral',
    phone1: '0412-1234567',
    phone2: '0212-7654321',
    email: 'juan@test.com',
    address: 'Av. Principal, Edif. A, Piso 2',
    whatsapp: '0412-1234567',
    schoolPeriodId: structure.period.id,
    gradeId: structure.grade.id,
    sectionId: structure.section.id,
    escolaridad: 'regular',
    mother: {
      firstName: 'María',
      lastName: 'González',
      documentType: 'Venezolano',
      document: String(++docCounter),
      phone: '0414-1112233',
      email: 'maria@test.com',
      birthdate: '1985-03-20',
      occupation: 'Docente',
      residenceState: 'Distrito Capital',
      residenceMunicipality: 'Libertador',
      residenceParish: 'Catedral',
      address: 'Calle Real, Casa #5',
    },
    father: {
      firstName: 'Pedro',
      lastName: 'Pérez',
      documentType: 'Venezolano',
      document: String(++docCounter),
      phone: '0416-4445566',
      email: 'pedro@test.com',
      birthdate: '1980-07-10',
      occupation: 'Ingeniero',
      residenceState: 'Distrito Capital',
      residenceMunicipality: 'Libertador',
      residenceParish: 'Catedral',
      address: 'Calle Real, Casa #5',
    },
    enrollmentAnswers: [],
    ...overrides,
  });

  describe('POST /api/inscriptions/register — basic enrollment', () => {
    it('should register a student with full data and verify all types', async () => {
      const structure = await createAcademicStructure();

      const payload = createEnrollmentPayload(structure);

      const res = await agent
        .post('/api/inscriptions/register')
        .send(payload)
        .expect(201);

      expect(res.body.message).toMatch(/exitosa/i);
      expect(res.body.person).toHaveProperty('id');
      expect(res.body.matriculation).toHaveProperty('id');
      expect(res.body).toHaveProperty('reportUuid');

      // Verify Person record
      const person = await Person.findByPk(res.body.person.id);
      expect(person).not.toBeNull();
      // Person.beforeCreate uppercases firstName/lastName/pathology/livingWith
      expect(person!.firstName).toBe('JUAN');
      expect(person!.lastName).toBe('PÉREZ');
      expect(person!.documentType).toBe('Venezolano');
      expect(person!.document).toBe(payload.document); // stored as-is
      expect(person!.gender).toBe('M');
      expect(person!.birthdate).toBeTruthy(); // birthdate stored
      expect(person!.pathology).toBe('ASMA');
      expect(person!.livingWith).toBe('AMBOS_PADRES');
      expect(person!.userId).toBeNull(); // student has no user account
    });

    it('should store only digits for Venezolano (strips a V prefix)', async () => {
      const structure = await createAcademicStructure();
      const payload = createEnrollmentPayload(structure, { documentType: 'Venezolano', document: 'V-11.111.111' });
      const res = await agent
        .post('/api/inscriptions/register')
        .send(payload)
        .expect(201);

      const person = await Person.findByPk(res.body.person.id);
      expect(person!.document).toBe('11111111');
    });

    it('should store only digits for Extranjero (strips an E prefix)', async () => {
      const structure = await createAcademicStructure();
      const payload = createEnrollmentPayload(structure, { documentType: 'Extranjero', document: 'E22222222' });
      const res = await agent
        .post('/api/inscriptions/register')
        .send(payload)
        .expect(201);

      const person = await Person.findByPk(res.body.person.id);
      expect(person!.document).toBe('22222222');
    });

    it('should store only digits for guardian documents too', async () => {
      const structure = await createAcademicStructure();
      const payload = createEnrollmentPayload(structure);
      const motherDigits = payload.mother.document;
      payload.mother = { ...payload.mother, document: `V-${motherDigits}` };

      await agent.post('/api/inscriptions/register').send(payload).expect(201);

      const profile = await GuardianProfile.findOne({ where: { document: motherDigits } });
      expect(profile).not.toBeNull();
    });

    it('should normalize the document when a person is edited', async () => {
      const structure = await createAcademicStructure();
      const res = await agent
        .post('/api/inscriptions/register')
        .send(createEnrollmentPayload(structure))
        .expect(201);

      const person = await Person.findByPk(res.body.person.id);
      await person!.update({ document: 'V33333333' });
      await person!.reload();
      expect(person!.document).toBe('33333333');
    });

    it('should not add prefix for Pasaporte', async () => {
      const structure = await createAcademicStructure();
      const res = await agent
        .post('/api/inscriptions/register')
        .send(createEnrollmentPayload(structure, { documentType: 'Pasaporte', document: 'AB123456' }))
        .expect(201);

      const person = await Person.findByPk(res.body.person.id);
      expect(person!.document).toBe('AB123456');
    });

    it('should auto-generate a digits-only document for Cedula Escolar', async () => {
      const structure = await createAcademicStructure();
      const payload = createEnrollmentPayload(structure, {
        documentType: 'Cedula Escolar',
        document: '',
        nationality: 'Venezolano',
      });
      const res = await agent
        .post('/api/inscriptions/register')
        .send(payload)
        .expect(201);

      const person = await Person.findByPk(res.body.person.id);
      expect(person!.documentType).toBe('Cedula Escolar');
      // birth order (1) + 2-digit birth year (10) + mother's document, no letter
      expect(person!.document).toBe(`110${payload.mother.document}`);
    });

    it('should store pathology correctly (text value)', async () => {
      const structure = await createAcademicStructure();
      const res = await agent
        .post('/api/inscriptions/register')
        .send(createEnrollmentPayload(structure, { pathology: 'Asma y alergias' }))
        .expect(201);

      const person = await Person.findByPk(res.body.person.id);
      expect(person!.pathology).toBe('ASMA Y ALERGIAS');
    });

    it('should store null pathology for none/nulla', async () => {
      const structure = await createAcademicStructure();
      const res = await agent
        .post('/api/inscriptions/register')
        .send(createEnrollmentPayload(structure, { pathology: null }))
        .expect(201);

      const person = await Person.findByPk(res.body.person.id);
      expect(person!.pathology).toBeNull();
    });

    it('should store livingWith as string', async () => {
      const structure = await createAcademicStructure();
      const res = await agent
        .post('/api/inscriptions/register')
        .send(createEnrollmentPayload(structure, { livingWith: 'madre' }))
        .expect(201);

      const person = await Person.findByPk(res.body.person.id);
      expect(person!.livingWith).toBe('MADRE');
    });

    it('should store birthdate as Date object', async () => {
      const structure = await createAcademicStructure();
      const res = await agent
        .post('/api/inscriptions/register')
        .send(createEnrollmentPayload(structure, { birthdate: '2012-08-20' }))
        .expect(201);

      const person = await Person.findByPk(res.body.person.id);
      const bdate = person!.birthdate ? new Date(person!.birthdate) : null;
      expect(bdate).not.toBeNull();
      expect(bdate!.getFullYear()).toBe(2012);
      expect(bdate!.getMonth()).toBe(7); // August = 7 (0-indexed)
    });

    it('should store contact info (phone, email, address)', async () => {
      const structure = await createAcademicStructure();
      const res = await agent
        .post('/api/inscriptions/register')
        .send(createEnrollmentPayload(structure))
        .expect(201);

      const contact = await Contact.findOne({ where: { personId: res.body.person.id } });
      expect(contact).not.toBeNull();
      expect(contact!.phone1).toBe('0412-1234567');
      expect(contact!.phone2).toBe('0212-7654321');
      expect(contact!.email).toBe('juan@test.com');
      expect(contact!.address).toBe('Av. Principal, Edif. A, Piso 2');
      expect(contact!.whatsapp).toBe('0412-1234567');
    });

    it('should store residence data', async () => {
      const structure = await createAcademicStructure();
      const res = await agent
        .post('/api/inscriptions/register')
        .send(createEnrollmentPayload(structure))
        .expect(201);

      const residence = await PersonResidence.findOne({ where: { personId: res.body.person.id } });
      expect(residence).not.toBeNull();
      expect(residence!.birthState).toBe('Distrito Capital');
      expect(residence!.birthMunicipality).toBe('Libertador');
      expect(residence!.birthParish).toBe('Catedral');
      expect(residence!.residenceState).toBe('Distrito Capital');
      expect(residence!.residenceMunicipality).toBe('Libertador');
      expect(residence!.residenceParish).toBe('Catedral');
    });

    it('should create guardian profiles for mother and father', async () => {
      const structure = await createAcademicStructure();
      const res = await agent
        .post('/api/inscriptions/register')
        .send(createEnrollmentPayload(structure))
        .expect(201);

      const guardians = await StudentGuardian.findAll({
        where: { studentId: res.body.person.id },
        include: [{ model: GuardianProfile, as: 'profile' }],
      });
      expect(guardians.length).toBe(2);

      const mother = guardians.find((g: any) => g.relationship === 'mother') as any;
      expect(mother).toBeDefined();
      // GuardianProfile.beforeCreate uppercases firstName/lastName
      expect(mother.profile.firstName).toBe('MARÍA');
      expect(mother.profile.phone).toBe('0414-1112233');

      const father = guardians.find((g: any) => g.relationship === 'father') as any;
      expect(father).toBeDefined();
      expect(father.profile.firstName).toBe('PEDRO');
    });

    it('should create matriculation with correct data', async () => {
      const structure = await createAcademicStructure();
      const res = await agent
        .post('/api/inscriptions/register')
        .send(createEnrollmentPayload(structure))
        .expect(201);

      const matriculation = await Matriculation.findByPk(res.body.matriculation.id);
      expect(matriculation).not.toBeNull();
      expect(matriculation!.schoolPeriodId).toBe(structure.period.id);
      expect(matriculation!.gradeId).toBe(structure.grade.id);
      expect(matriculation!.sectionId).toBe(structure.section.id);
      expect(matriculation!.status).toBeDefined();
    });

    it('should reject missing required fields with 400 and the real reason', async () => {
      const structure = await createAcademicStructure();
      const res = await agent
        .post('/api/inscriptions/register')
        .send({ ...createEnrollmentPayload(structure), firstName: '' })
        .expect(400);
      expect(res.body.error).toBe('Datos básicos del estudiante incompletos');
    });

    it('should reject invalid birthdate with 400', async () => {
      const structure = await createAcademicStructure();
      const res = await agent
        .post('/api/inscriptions/register')
        .send(createEnrollmentPayload(structure, { birthdate: 'not-a-date' }))
        .expect(400);
      expect(res.body.error).toBe('Fecha de nacimiento inválida');
    });

    it('should accept a representative mother without email (email is optional)', async () => {
      const structure = await createAcademicStructure();
      const payload = createEnrollmentPayload(structure);
      payload.mother = { ...payload.mother, email: '' };

      const res = await agent
        .post('/api/inscriptions/register')
        .send(payload)
        .expect(201);

      const profile = await GuardianProfile.findOne({ where: { document: payload.mother.document } });
      expect(profile).not.toBeNull();
      expect(profile!.email).toBe('');
      expect(res.body.matriculation.status).toBe('pending');
    });

    it('should keep an existing guardian email when a new enrollment leaves it blank', async () => {
      const structure = await createAcademicStructure();
      const first = createEnrollmentPayload(structure);
      await agent.post('/api/inscriptions/register').send(first).expect(201);

      const second = createEnrollmentPayload(structure);
      second.mother = { ...first.mother, email: '' };
      await agent.post('/api/inscriptions/register').send(second).expect(201);

      const profile = await GuardianProfile.findOne({ where: { document: first.mother.document } });
      expect(profile!.email).toBe('maria@test.com');
    });

    it('should reject a representative mother without phone with 400 and a readable message', async () => {
      const structure = await createAcademicStructure();
      const payload = createEnrollmentPayload(structure);
      payload.mother = { ...payload.mother, phone: '' };

      const res = await agent
        .post('/api/inscriptions/register')
        .send(payload)
        .expect(400);
      expect(res.body.error).toBe('Faltan campos obligatorios para la madre: teléfono');
    });

    it('should accept enrollment without father (optional)', async () => {
      const structure = await createAcademicStructure();
      const payload = createEnrollmentPayload(structure);
      delete (payload as any).father;

      const res = await agent
        .post('/api/inscriptions/register')
        .send(payload)
        .expect(201);

      const guardians = await StudentGuardian.findAll({
        where: { studentId: res.body.person.id },
      });
      expect(guardians.length).toBe(1); // only mother
    });
  });
});