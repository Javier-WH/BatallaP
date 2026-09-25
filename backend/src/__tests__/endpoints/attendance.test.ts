import request from 'supertest';
import app from '@/app';
import {
  createTestUser,
  createTestRole,
  createAcademicStructure,
  createTestInscription,
} from '../helpers/testData';
import { PersonRole, Schedule, ScheduleEntry } from '@/models/index';

const MONDAY = '2026-09-14'; // Monday

async function createLoginAgent(username: string, roleName: 'Profesor' | 'Control de Estudios' | 'Administrador' | 'Master') {
  const agent = request.agent(app);
  const { user, person } = await createTestUser({ username });
  const role = await createTestRole(roleName);
  await PersonRole.create({ personId: person.id, roleId: role.id });
  await agent.post('/api/auth/login').send({ username: user.username, password: 'password123' });
  return { agent, user, person };
}

async function buildTeacherSetup() {
  const structure = await createAcademicStructure();
  const { agent, person } = await createLoginAgent('attteacher', 'Profesor');

  const schedule = await Schedule.create({
    schoolPeriodId: structure.period.id,
    periodGradeSectionId: structure.periodGradeSection.id,
    status: 'published',
  });
  const entry = await ScheduleEntry.create({
    scheduleId: schedule.id,
    day: 'Lunes',
    periodId: 'm1',
    subjectId: structure.subject.id,
    teacherId: person.id,
    isGroupSubject: false,
  });

  const { person: studentPerson } = await createTestUser({
    username: 'attstudent',
    firstName: 'Ana',
    lastName: 'Alumno',
  });
  const inscription = await createTestInscription(
    studentPerson.id,
    structure.period.id,
    structure.grade.id,
    structure.section.id
  );

  return { structure, agent, person, schedule, entry, inscription };
}

describe('Attendance endpoints', () => {
  describe('GET /api/attendance/my-sessions', () => {
    it('retorna sesiones del profesor para la fecha', async () => {
      const { agent } = await buildTeacherSetup();

      const res = await agent.get(`/api/attendance/my-sessions?date=${MONDAY}`);

      expect(res.status).toBe(200);
      expect(res.body.sessions).toHaveLength(1);
      expect(res.body.sessions[0].periodId).toBe('m1');
      expect(res.body.sessions[0].sessionDate).toBe(MONDAY);
    });

    it('rechaza fechas inválidas', async () => {
      const { agent } = await buildTeacherSetup();

      const res = await agent.get('/api/attendance/my-sessions?date=invalid');

      expect(res.status).toBe(400);
    });

    it('filtra sesiones por schoolPeriodId cuando se envía', async () => {
      const { agent } = await buildTeacherSetup();
      const otherStructure = await createAcademicStructure();

      const res = await agent.get(
        `/api/attendance/my-sessions?date=${MONDAY}&schoolPeriodId=${otherStructure.period.id}`
      );

      expect(res.status).toBe(200);
      expect(res.body.sessions).toHaveLength(0);
    });

    it('retorna sesiones del período correcto', async () => {
      const { agent, structure } = await buildTeacherSetup();

      const res = await agent.get(
        `/api/attendance/my-sessions?date=${MONDAY}&schoolPeriodId=${structure.period.id}`
      );

      expect(res.status).toBe(200);
      expect(res.body.sessions).toHaveLength(1);
    });

    it('rechaza usuarios sin rol de asistencia', async () => {
      const agent = request.agent(app);
      const { person } = await createTestUser({ username: 'norole' });
      const role = await createTestRole('Alumno');
      await PersonRole.create({ personId: person.id, roleId: role.id });
      await agent.post('/api/auth/login').send({ username: 'norole', password: 'password123' });

      const res = await agent.get(`/api/attendance/my-sessions?date=${MONDAY}`);

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/attendance/sessions/:id/records', () => {
    it('el profesor guarda asistencia de su propia sesión', async () => {
      const { agent, inscription } = await buildTeacherSetup();

      const sessionsRes = await agent.get(`/api/attendance/my-sessions?date=${MONDAY}`);
      const sessionId = sessionsRes.body.sessions[0].id;

      const res = await agent.put(`/api/attendance/sessions/${sessionId}/records`).send({
        records: [{ inscriptionId: inscription.id, status: 'present' }],
      });

      expect(res.status).toBe(200);
      expect(res.body.created).toBe(1);
    });

    it('permite absent sin motivo', async () => {
      const { agent, inscription } = await buildTeacherSetup();

      const sessionsRes = await agent.get(`/api/attendance/my-sessions?date=${MONDAY}`);
      const sessionId = sessionsRes.body.sessions[0].id;

      const res = await agent.put(`/api/attendance/sessions/${sessionId}/records`).send({
        records: [{ inscriptionId: inscription.id, status: 'absent' }],
      });

      expect(res.status).toBe(200);
      expect(res.body.created).toBe(1);
    });

    it('rechaza expulsado sin motivo', async () => {
      const { agent, inscription } = await buildTeacherSetup();

      const sessionsRes = await agent.get(`/api/attendance/my-sessions?date=${MONDAY}`);
      const sessionId = sessionsRes.body.sessions[0].id;

      const res = await agent.put(`/api/attendance/sessions/${sessionId}/records`).send({
        records: [{ inscriptionId: inscription.id, status: 'kicked' }],
      });

      expect(res.status).toBe(400);
    });

    it('un profesor no puede guardar en sesión ajena', async () => {
      const { structure, inscription } = await buildTeacherSetup();
      const other = await createLoginAgent('otherteacher', 'Profesor');

      // Session owned by the first teacher
      const firstTeacherSession = await (await import('@/models')).AttendanceSession.create({
        scheduleEntryId: (await ScheduleEntry.findOne())!.id,
        schoolPeriodId: structure.period.id,
        sessionDate: MONDAY,
      });

      const res = await other.agent.put(`/api/attendance/sessions/${firstTeacherSession.id}/records`).send({
        records: [{ inscriptionId: inscription.id, status: 'present' }],
      });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/attendance/clearance-reasons', () => {
    it('retorna motivos con siembra automática', async () => {
      const { agent } = await buildTeacherSetup();

      const res = await agent.get('/api/attendance/clearance-reasons');

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('POST /api/attendance/records/:id/clear', () => {
    it('Control de Estudios puede desbloquear cualquier registro', async () => {
      const { agent, inscription, structure } = await buildTeacherSetup();
      const ce = await createLoginAgent('attcontrol', 'Control de Estudios');

      const sessionsRes = await agent.get(`/api/attendance/my-sessions?date=${MONDAY}`);
      const sessionId = sessionsRes.body.sessions[0].id;

      await agent.put(`/api/attendance/sessions/${sessionId}/records`).send({
        records: [{ inscriptionId: inscription.id, status: 'absent', reason: 'No llegó' }],
      });
      const { AttendanceRecord, ClearanceReason } = await import('@/models');
      const record = await AttendanceRecord.findOne({ where: { sessionId } });
      await record!.update({ blocked: true });
      await ClearanceReason.create({ code: 'admin_authorized', label: 'Autorizado', requiresNote: false, active: true });

      const res = await ce.agent.post(`/api/attendance/records/${record!.id}/clear`).send({
        reasonCode: 'admin_authorized',
      });

      expect(res.status).toBe(200);
      expect(res.body.blocked).toBe(false);
      expect(res.body.clearanceReasonCode).toBe('admin_authorized');
    });
  });

  describe('GET /api/attendance/students/:personId/summary', () => {
    it('staff obtiene el historial del estudiante', async () => {
      const { agent, inscription, structure } = await buildTeacherSetup();
      const admin = await createLoginAgent('attadmin', 'Administrador');

      const sessionsRes = await agent.get(`/api/attendance/my-sessions?date=${MONDAY}`);
      const sessionId = sessionsRes.body.sessions[0].id;
      await agent.put(`/api/attendance/sessions/${sessionId}/records`).send({
        records: [{ inscriptionId: inscription.id, status: 'late' }],
      });

      const { Inscription } = await import('@/models');
      const ins = await Inscription.findByPk(inscription.id);

      const res = await admin.agent.get(
        `/api/attendance/students/${ins!.personId}/summary?schoolPeriodId=${structure.period.id}`
      );

      expect(res.status).toBe(200);
      expect(res.body.totals.late).toBe(1);
      expect(res.body.records[0].status).toBe('late');
    });
  });
});
