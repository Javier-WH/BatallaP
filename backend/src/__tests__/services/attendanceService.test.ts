import {
  getDayNameForDate,
  getTeacherSessionsForDate,
  getSessionDetail,
  saveSessionRecords,
  clearAttendanceBlock,
  clearSessionBlock,
  listClearanceReasons,
} from '@/services/attendanceService';
import {
  Schedule,
  ScheduleEntry,
  AttendanceSession,
  AttendanceRecord,
  AttendanceAuditLog,
  ClearanceReason,
} from '@/models/index';
import {
  createTestUser,
  createAcademicStructure,
  createTestInscription,
} from '../helpers/testData';

const MONDAY = '2026-09-14';   // Monday
const SATURDAY = '2026-09-19'; // Saturday

async function setupTeacherWithSchedule(day: string, periodId: string) {
  const structure = await createAcademicStructure();
  const { user, person } = await createTestUser({ firstName: 'Profe', lastName: 'Uno' });

  const schedule = await Schedule.create({
    schoolPeriodId: structure.period.id,
    periodGradeSectionId: structure.periodGradeSection.id,
    status: 'published',
  });
  const entry = await ScheduleEntry.create({
    scheduleId: schedule.id,
    day,
    periodId,
    subjectId: structure.subject.id,
    teacherId: person.id,
    isGroupSubject: false,
  });

  return { structure, user, person, schedule, entry };
}

async function setupStudent(structure: any, suffix: string) {
  const { person } = await createTestUser({
    firstName: `Est${suffix}`,
    lastName: 'udiante',
  });
  const inscription = await createTestInscription(
    person.id,
    structure.period.id,
    structure.grade.id,
    structure.section.id
  );
  return { person, inscription };
}

describe('attendanceService', () => {
  describe('getDayNameForDate', () => {
    it('mapea lunes a "Lunes"', () => {
      expect(getDayNameForDate(MONDAY)).toBe('Lunes');
    });

    it('mapea viernes a "Viernes"', () => {
      expect(getDayNameForDate('2026-09-18')).toBe('Viernes');
    });

    it('retorna vacío para sábado y domingo', () => {
      expect(getDayNameForDate(SATURDAY)).toBe('');
      expect(getDayNameForDate('2026-09-20')).toBe('');
    });
  });

  describe('getTeacherSessionsForDate', () => {
    it('crea y retorna sesiones desde el horario del profesor', async () => {
      const { person } = await setupTeacherWithSchedule('Lunes', 'm1');

      const sessions = await getTeacherSessionsForDate(person.id, MONDAY);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].periodId).toBe('m1');
      expect(sessions[0].sessionDate).toBe(MONDAY);
      expect(sessions[0].subjectName).toBeTruthy();
      // Session persisted
      const persisted = await AttendanceSession.findAll();
      expect(persisted).toHaveLength(1);
      expect(persisted[0].scheduleEntryId).toBe(sessions[0].scheduleEntryId);
    });

    it('es idempotente: la segunda llamada no duplica sesiones', async () => {
      const { person } = await setupTeacherWithSchedule('Lunes', 'm1');

      await getTeacherSessionsForDate(person.id, MONDAY);
      await getTeacherSessionsForDate(person.id, MONDAY);

      expect(await AttendanceSession.findAll()).toHaveLength(1);
    });

    it('retorna vacío en fin de semana', async () => {
      const { person } = await setupTeacherWithSchedule('Lunes', 'm1');

      const sessions = await getTeacherSessionsForDate(person.id, SATURDAY);
      expect(sessions).toHaveLength(0);
    });

    it('ordena mañana antes que tarde', async () => {
      const { person, schedule } = await setupTeacherWithSchedule('Lunes', 't1');
      await ScheduleEntry.create({
        scheduleId: schedule.id,
        day: 'Lunes',
        periodId: 'm2',
        subjectId: null,
        teacherId: person.id,
        isGroupSubject: false,
      });

      const sessions = await getTeacherSessionsForDate(person.id, MONDAY);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].periodId).toBe('m2');
      expect(sessions[1].periodId).toBe('t1');
    });

    it('permite backfill de fechas pasadas', async () => {
      const { person } = await setupTeacherWithSchedule('Lunes', 'm1');
      const pastMonday = '2026-09-07';

      const sessions = await getTeacherSessionsForDate(person.id, pastMonday);

      expect(sessions).toHaveLength(1);
      expect(sessions[0].sessionDate).toBe(pastMonday);
    });
  });

  describe('getSessionDetail', () => {
    it('retorna la nómina de la sección con registros vacíos al inicio', async () => {
      const { structure, person, entry } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      const [session] = await getTeacherSessionsForDate(person.id, MONDAY);

      const detail = await getSessionDetail(session.id);

      expect(detail.session.id).toBe(session.id);
      expect(detail.roster).toHaveLength(1);
      expect(detail.roster[0].inscriptionId).toBe(inscription.id);
      expect(detail.roster[0].status).toBeNull();
      expect(detail.roster[0].blocked).toBe(false);
      expect(detail.roster[0].fullName).toBeTruthy();
    });
  });

  describe('saveSessionRecords', () => {
    it('crea registros y escribe auditoría "marked"', async () => {
      const { structure, person } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      const [session] = await getTeacherSessionsForDate(person.id, MONDAY);

      await saveSessionRecords(session.id, [
        { inscriptionId: inscription.id, status: 'present' },
      ], person.id);

      const record = await AttendanceRecord.findOne({ where: { sessionId: session.id } });
      expect(record!.status).toBe('present');
      expect(record!.teacherId).toBe(person.id);

      const audit = await AttendanceAuditLog.findOne({ where: { attendanceRecordId: record!.id } });
      expect(audit!.action).toBe('marked');
      expect(audit!.performedBy).toBe(person.id);
    });

    it('actualiza el estado y escribe auditoría "status_changed"', async () => {
      const { structure, person } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      const [session] = await getTeacherSessionsForDate(person.id, MONDAY);

      await saveSessionRecords(session.id, [
        { inscriptionId: inscription.id, status: 'present' },
      ], person.id);
      await saveSessionRecords(session.id, [
        { inscriptionId: inscription.id, status: 'late' },
      ], person.id);

      const audits = await AttendanceAuditLog.findAll({ order: [['id', 'ASC']] });
      expect(audits).toHaveLength(2);
      expect(audits[0].action).toBe('marked');
      expect(audits[1].action).toBe('status_changed');
      expect(audits[1].previousValue).toEqual({ status: 'present' });
      expect(audits[1].newValue).toEqual({ status: 'late' });
    });

    it('no duplica auditoría cuando el estado no cambia', async () => {
      const { structure, person } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      const [session] = await getTeacherSessionsForDate(person.id, MONDAY);

      await saveSessionRecords(session.id, [
        { inscriptionId: inscription.id, status: 'present' },
      ], person.id);
      await saveSessionRecords(session.id, [
        { inscriptionId: inscription.id, status: 'present' },
      ], person.id);

      expect(await AttendanceAuditLog.findAll()).toHaveLength(1);
    });

    it('permite "absent" sin motivo', async () => {
      const { structure, person } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      const [session] = await getTeacherSessionsForDate(person.id, MONDAY);

      await expect(saveSessionRecords(session.id, [
        { inscriptionId: inscription.id, status: 'absent' },
      ], person.id)).resolves.toMatchObject({ created: 1 });
      await expect(AttendanceRecord.findOne({ where: { sessionId: session.id, inscriptionId: inscription.id } }))
        .resolves.toMatchObject({ status: 'absent', reason: null });
      await expect(AttendanceAuditLog.findOne({ where: { action: 'marked' } }))
        .resolves.toMatchObject({ newValue: { status: 'absent', reason: null } });
    });

    it('rechaza "kicked" sin motivo', async () => {
      const { structure, person } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      const [session] = await getTeacherSessionsForDate(person.id, MONDAY);

      await expect(saveSessionRecords(session.id, [
        { inscriptionId: inscription.id, status: 'kicked' },
      ], person.id)).rejects.toThrow();
    });

    it('marca blocked cuando hubo ausencia sin desbloquear en sesión anterior del día', async () => {
      const { structure, person, schedule } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      const entry2 = await ScheduleEntry.create({
        scheduleId: schedule.id,
        day: 'Lunes',
        periodId: 'm2',
        subjectId: null,
        teacherId: person.id,
        isGroupSubject: false,
      });

      const [s1] = await getTeacherSessionsForDate(person.id, MONDAY);
      await saveSessionRecords(s1.id, [
        { inscriptionId: inscription.id, status: 'absent', reason: 'No llegó' },
      ], person.id);

      // Simulate the second session of the day (m2)
      const s2 = await AttendanceSession.findOrCreate({
        where: { scheduleEntryId: entry2.id, sessionDate: MONDAY },
        defaults: { scheduleEntryId: entry2.id, schoolPeriodId: structure.period.id, sessionDate: MONDAY },
      }).then(([s]) => s);

      await saveSessionRecords(s2.id, [
        { inscriptionId: inscription.id, status: 'present' },
      ], person.id);

      const record = await AttendanceRecord.findOne({ where: { sessionId: s2.id } });
      expect(record!.blocked).toBe(true);

      const blockedAudit = await AttendanceAuditLog.findOne({
        where: { attendanceRecordId: record!.id, action: 'blocked' },
      });
      expect(blockedAudit).not.toBeNull();
    });

    it('no marca blocked si la ausencia anterior fue desbloqueada', async () => {
      const { structure, person, schedule } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      const entry2 = await ScheduleEntry.create({
        scheduleId: schedule.id,
        day: 'Lunes',
        periodId: 'm2',
        subjectId: null,
        teacherId: person.id,
        isGroupSubject: false,
      });

      const [s1] = await getTeacherSessionsForDate(person.id, MONDAY);
      await saveSessionRecords(s1.id, [
        { inscriptionId: inscription.id, status: 'absent', reason: 'No llegó' },
      ], person.id);

      // Force the block on the first record, then clear it
      const r1 = await AttendanceRecord.findOne({ where: { sessionId: s1.id } });
      await r1!.update({ blocked: true });
      await listClearanceReasons();
      await clearAttendanceBlock(r1!.id, person.id, 'parent_note', null);

      const s2 = await AttendanceSession.findOrCreate({
        where: { scheduleEntryId: entry2.id, sessionDate: MONDAY },
        defaults: { scheduleEntryId: entry2.id, schoolPeriodId: structure.period.id, sessionDate: MONDAY },
      }).then(([s]) => s);

      await saveSessionRecords(s2.id, [
        { inscriptionId: inscription.id, status: 'present' },
      ], person.id);

      const record = await AttendanceRecord.findOne({ where: { sessionId: s2.id } });
      expect(record!.blocked).toBe(false);
    });
  });

  describe('clearAttendanceBlock', () => {
    beforeEach(async () => {
      await listClearanceReasons();
    });

    it('desbloquea con motivo y escribe auditoría "cleared"', async () => {
      const { structure, person } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      const [session] = await getTeacherSessionsForDate(person.id, MONDAY);
      await saveSessionRecords(session.id, [
        { inscriptionId: inscription.id, status: 'absent', reason: 'No llegó' },
      ], person.id);
      const record = await AttendanceRecord.findOne({ where: { sessionId: session.id } });
      // Force blocked state
      await record!.update({ blocked: true });

      const cleared = await clearAttendanceBlock(record!.id, person.id, 'parent_note', null);

      expect(cleared.blocked).toBe(false);
      expect(cleared.clearedBy).toBe(person.id);
      expect(cleared.clearanceReasonCode).toBe('parent_note');

      const audit = await AttendanceAuditLog.findOne({
        where: { attendanceRecordId: record!.id, action: 'cleared' },
      });
      expect(audit).not.toBeNull();
      expect(audit!.reasonCode).toBe('parent_note');
      expect(audit!.previousValue).toEqual({ blocked: true });
      expect(audit!.newValue).toEqual({ blocked: false, clearedBy: person.id });
    });

    it('rechaza cuando el motivo requiere nota y no se envía', async () => {
      const { structure, person } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      const [session] = await getTeacherSessionsForDate(person.id, MONDAY);
      await saveSessionRecords(session.id, [
        { inscriptionId: inscription.id, status: 'absent', reason: 'No llegó' },
      ], person.id);
      const record = await AttendanceRecord.findOne({ where: { sessionId: session.id } });
      await record!.update({ blocked: true });

      await expect(
        clearAttendanceBlock(record!.id, person.id, 'other', null)
      ).rejects.toThrow();
    });

    it('rechaza si el registro no está bloqueado', async () => {
      const { structure, person } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      const [session] = await getTeacherSessionsForDate(person.id, MONDAY);
      await saveSessionRecords(session.id, [
        { inscriptionId: inscription.id, status: 'present' },
      ], person.id);
      const record = await AttendanceRecord.findOne({ where: { sessionId: session.id } });

      await expect(
        clearAttendanceBlock(record!.id, person.id, 'parent_note', null)
      ).rejects.toThrow();
    });
  });

  describe('listClearanceReasons', () => {
    it('siembra motivos por defecto la primera vez', async () => {
      const reasons = await listClearanceReasons();

      expect(reasons.length).toBeGreaterThanOrEqual(4);
      const codes = reasons.map(r => r.code);
      expect(codes).toContain('nurse_visit');
      expect(codes).toContain('admin_authorized');
      expect(codes).toContain('parent_note');
      expect(codes).toContain('other');

      const other = reasons.find(r => r.code === 'other');
      expect(other!.requiresNote).toBe(true);

      // Idempotent
      await listClearanceReasons();
      expect(await ClearanceReason.findAll()).toHaveLength(reasons.length);
    });
  });

  describe('getSessionDetail — priorBlock', () => {
    it('retorna priorBlock para ausente sin desbloquear en sesión anterior del día', async () => {
      const { structure, person, schedule } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      await ScheduleEntry.create({
        scheduleId: schedule.id,
        day: 'Lunes',
        periodId: 'm2',
        subjectId: null,
        teacherId: person.id,
        isGroupSubject: false,
      });

      const sessions = await getTeacherSessionsForDate(person.id, MONDAY);
      const [s1, s2] = sessions;

      await saveSessionRecords(s1.id, [
        { inscriptionId: inscription.id, status: 'absent', reason: 'No llegó' },
      ], person.id);

      const detail = await getSessionDetail(s2.id);
      const entry = detail.roster.find(r => r.inscriptionId === inscription.id);
      expect(entry!.priorBlock).not.toBeNull();
      expect(entry!.priorBlock!.status).toBe('absent');
      expect(entry!.priorBlock!.periodId).toBe('m1');
    });

    it('no retorna priorBlock en la primera sesión del día', async () => {
      const { structure, person } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');

      const [s1] = await getTeacherSessionsForDate(person.id, MONDAY);
      const detail = await getSessionDetail(s1.id);
      const entry = detail.roster.find(r => r.inscriptionId === inscription.id);
      expect(entry!.priorBlock).toBeNull();
    });

    it('suprime priorBlock si el estudiante fue desbloqueado en la sesión actual', async () => {
      const { structure, person, schedule } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      await ScheduleEntry.create({
        scheduleId: schedule.id,
        day: 'Lunes',
        periodId: 'm2',
        subjectId: null,
        teacherId: person.id,
        isGroupSubject: false,
      });

      const sessions = await getTeacherSessionsForDate(person.id, MONDAY);
      const [s1, s2] = sessions;

      await saveSessionRecords(s1.id, [
        { inscriptionId: inscription.id, status: 'absent', reason: 'No llegó' },
      ], person.id);
      await listClearanceReasons();
      await clearSessionBlock(s2.id, inscription.id, person.id, 'parent_note', null);

      const detail = await getSessionDetail(s2.id);
      const entry = detail.roster.find(r => r.inscriptionId === inscription.id);
      expect(entry!.priorBlock).toBeNull();
      expect(entry!.status).toBe('present');
      expect(entry!.blocked).toBe(false);
      expect(entry!.clearanceReasonCode).toBe('parent_note');
    });
  });

  describe('clearSessionBlock', () => {
    beforeEach(async () => {
      await listClearanceReasons();
    });

    it('crea el registro si no existe y lo desbloquea con auditoría completa', async () => {
      const { structure, person, schedule } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      await ScheduleEntry.create({
        scheduleId: schedule.id,
        day: 'Lunes',
        periodId: 'm2',
        subjectId: null,
        teacherId: person.id,
        isGroupSubject: false,
      });

      const sessions = await getTeacherSessionsForDate(person.id, MONDAY);
      const [s1, s2] = sessions;
      await saveSessionRecords(s1.id, [
        { inscriptionId: inscription.id, status: 'absent', reason: 'No llegó' },
      ], person.id);

      const record = await clearSessionBlock(s2.id, inscription.id, person.id, 'parent_note', null);

      expect(record.status).toBe('present');
      expect(record.blocked).toBe(false);
      expect(record.clearanceReasonCode).toBe('parent_note');

      const actions = (await AttendanceAuditLog.findAll({
        where: { attendanceRecordId: record.id },
        order: [['id', 'ASC']],
      })).map(a => a.action);
      expect(actions).toEqual(['marked', 'blocked', 'cleared']);
    });

    it('rechaza cuando el motivo requiere nota y no se envía', async () => {
      const { structure, person } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      const [s1] = await getTeacherSessionsForDate(person.id, MONDAY);

      await expect(
        clearSessionBlock(s1.id, inscription.id, person.id, 'other', null)
      ).rejects.toThrow();
    });
  });
});
