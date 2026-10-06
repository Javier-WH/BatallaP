import {
  getDayNameForDate,
  getTeacherSessionsForDate,
  getSessionDetail,
  saveSessionRecords,
  clearAttendanceBlock,
  clearSessionBlock,
  listClearanceReasons,
  getTeacherWeekTemplate,
  saveOfflineRecords,
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

    it('marca blocked cuando hubo una expulsión sin desbloquear en clase anterior del mismo turno', async () => {
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
        { inscriptionId: inscription.id, status: 'kicked', reason: 'Pelea' },
      ], person.id);

      // Simulate the second session of the day (m2)
      const s2 = await AttendanceSession.findOrCreate({
        where: { scheduleEntryId: entry2.id, sessionDate: MONDAY },
        defaults: { scheduleEntryId: entry2.id, schoolPeriodId: structure.period.id, sessionDate: MONDAY },
      }).then(([s]) => s);

      await saveSessionRecords(s2.id, [
        { inscriptionId: inscription.id, status: 'absent' },
      ], person.id);

      const record = await AttendanceRecord.findOne({ where: { sessionId: s2.id } });
      expect(record!.blocked).toBe(true);

      const blockedAudit = await AttendanceAuditLog.findOne({
        where: { attendanceRecordId: record!.id, action: 'blocked' },
      });
      expect(blockedAudit).not.toBeNull();
    });

    it('no marca blocked si la expulsión anterior fue desbloqueada', async () => {
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
        { inscriptionId: inscription.id, status: 'kicked', reason: 'Pelea' },
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

    it('rechaza marcar (que no sea ausente) a un estudiante bloqueado sin desbloquear', async () => {
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
        { inscriptionId: inscription.id, status: 'kicked', reason: 'Pelea' },
      ], person.id);

      const s2 = await AttendanceSession.findOrCreate({
        where: { scheduleEntryId: entry2.id, sessionDate: MONDAY },
        defaults: { scheduleEntryId: entry2.id, schoolPeriodId: structure.period.id, sessionDate: MONDAY },
      }).then(([s]) => s);

      await expect(
        saveSessionRecords(s2.id, [{ inscriptionId: inscription.id, status: 'present' }], person.id)
      ).rejects.toThrow(/bloquead/);
      // An 'absent' write is allowed even while blocked.
      const ok = await saveSessionRecords(s2.id, [
        { inscriptionId: inscription.id, status: 'absent' },
      ], person.id);
      expect(ok.created).toBe(1);
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
    it('retorna priorBlock "kicked" para expulsado sin desbloquear en clase anterior del mismo turno', async () => {
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
        { inscriptionId: inscription.id, status: 'kicked', reason: 'Pelea' },
      ], person.id);

      const detail = await getSessionDetail(s2.id);
      const entry = detail.roster.find(r => r.inscriptionId === inscription.id);
      expect(entry!.priorBlock).not.toBeNull();
      expect(entry!.priorBlock!.kind).toBe('kicked');
      expect(entry!.priorBlock!.status).toBe('kicked');
      expect(entry!.priorBlock!.periodId).toBe('m1');
    });

    it('la expulsión no bloquea el turno siguiente (solo el mismo turno)', async () => {
      const { structure, person, schedule } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      await ScheduleEntry.create({
        scheduleId: schedule.id,
        day: 'Lunes',
        periodId: 't1',
        subjectId: null,
        teacherId: person.id,
        isGroupSubject: false,
      });

      const sessions = await getTeacherSessionsForDate(person.id, MONDAY);
      const [s1, s2] = sessions; // m1 y t1

      await saveSessionRecords(s1.id, [
        { inscriptionId: inscription.id, status: 'kicked', reason: 'Pelea' },
      ], person.id);

      const detail = await getSessionDetail(s2.id);
      const entry = detail.roster.find(r => r.inscriptionId === inscription.id);
      expect(entry!.priorBlock).toBeNull();
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
        { inscriptionId: inscription.id, status: 'kicked', reason: 'Pelea' },
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

    it('un solo desbloqueo libra todo el turno', async () => {
      const { structure, person, schedule } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      // m2 y m4 con subjectId null: periodos no consecutivos -> clases separadas.
      for (const periodId of ['m2', 'm4']) {
        await ScheduleEntry.create({
          scheduleId: schedule.id, day: 'Lunes', periodId,
          subjectId: null, teacherId: person.id, isGroupSubject: false,
        });
      }
      const [s1, s2, s3] = await getTeacherSessionsForDate(person.id, MONDAY);

      await saveSessionRecords(s1.id, [
        { inscriptionId: inscription.id, status: 'kicked', reason: 'Pelea' },
      ], person.id);
      await listClearanceReasons();
      await clearSessionBlock(s2.id, inscription.id, person.id, 'nurse_visit', null);

      const detail = await getSessionDetail(s3.id);
      expect(detail.roster.find(r => r.inscriptionId === inscription.id)!.priorBlock).toBeNull();
    });
  });

  describe('getSessionDetail — jubilado', () => {
    const FRIDAY = '2026-09-11';

    /** Friday afternoon with two classes (t1 subject, t2 plain) + Monday m1. */
    async function setupFridayThenMonday() {
      const structure = await createAcademicStructure();
      const { person } = await createTestUser({ firstName: 'Profe', lastName: 'Dos' });
      const schedule = await Schedule.create({
        schoolPeriodId: structure.period.id,
        periodGradeSectionId: structure.periodGradeSection.id,
        status: 'published',
      });
      await ScheduleEntry.create({
        scheduleId: schedule.id, day: 'Viernes', periodId: 't1',
        subjectId: structure.subject.id, teacherId: person.id, isGroupSubject: false,
      });
      await ScheduleEntry.create({
        scheduleId: schedule.id, day: 'Viernes', periodId: 't2',
        subjectId: null, teacherId: person.id, isGroupSubject: false,
      });
      await ScheduleEntry.create({
        scheduleId: schedule.id, day: 'Lunes', periodId: 'm1',
        subjectId: null, teacherId: person.id, isGroupSubject: false,
      });
      const { person: sp } = await createTestUser({ firstName: 'Est', lastName: 'B' });
      const inscription = await createTestInscription(
        sp.id, structure.period.id, structure.grade.id, structure.section.id);
      return { person, inscription };
    }

    it('bloquea el siguiente turno si estuvo presente y luego ausente sin justificar', async () => {
      const { structure, person, schedule } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      for (const periodId of ['m2', 't1']) {
        await ScheduleEntry.create({
          scheduleId: schedule.id, day: 'Lunes', periodId,
          subjectId: null, teacherId: person.id, isGroupSubject: false,
        });
      }
      const [sM1, sM2, sT1] = await getTeacherSessionsForDate(person.id, MONDAY);

      await saveSessionRecords(sM1.id, [{ inscriptionId: inscription.id, status: 'present' }], person.id);
      await saveSessionRecords(sM2.id, [{ inscriptionId: inscription.id, status: 'absent' }], person.id);

      const detail = await getSessionDetail(sT1.id);
      const entry = detail.roster.find(r => r.inscriptionId === inscription.id);
      expect(entry!.priorBlock).not.toBeNull();
      expect(entry!.priorBlock!.kind).toBe('retired');
      expect(entry!.priorBlock!.shift).toBe('m');
      expect(entry!.priorBlock!.sessionDate).toBe(MONDAY);
    });

    it('el bloqueo cruza el fin de semana: jubilado viernes tarde -> lunes', async () => {
      const { person, inscription } = await setupFridayThenMonday();
      const [fT1, fT2] = await getTeacherSessionsForDate(person.id, FRIDAY);
      const [sMon] = await getTeacherSessionsForDate(person.id, MONDAY);

      await saveSessionRecords(fT1.id, [{ inscriptionId: inscription.id, status: 'present' }], person.id);
      await saveSessionRecords(fT2.id, [{ inscriptionId: inscription.id, status: 'absent' }], person.id);

      const detail = await getSessionDetail(sMon.id);
      const entry = detail.roster.find(r => r.inscriptionId === inscription.id);
      expect(entry!.priorBlock).not.toBeNull();
      expect(entry!.priorBlock!.kind).toBe('retired');
      expect(entry!.priorBlock!.sessionDate).toBe(FRIDAY);
      expect(entry!.priorBlock!.shift).toBe('t');
    });

    it('ausente primero y presente después no es jubilado (llegó tarde)', async () => {
      const { structure, person, schedule } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      for (const periodId of ['m2', 't1']) {
        await ScheduleEntry.create({
          scheduleId: schedule.id, day: 'Lunes', periodId,
          subjectId: null, teacherId: person.id, isGroupSubject: false,
        });
      }
      const [sM1, sM2, sT1] = await getTeacherSessionsForDate(person.id, MONDAY);

      await saveSessionRecords(sM1.id, [{ inscriptionId: inscription.id, status: 'absent' }], person.id);
      await saveSessionRecords(sM2.id, [{ inscriptionId: inscription.id, status: 'present' }], person.id);

      const detail = await getSessionDetail(sT1.id);
      expect(detail.roster.find(r => r.inscriptionId === inscription.id)!.priorBlock).toBeNull();
    });

    it('ausente todo el turno no es jubilado (nunca llegó)', async () => {
      const { structure, person, schedule } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      for (const periodId of ['m2', 't1']) {
        await ScheduleEntry.create({
          scheduleId: schedule.id, day: 'Lunes', periodId,
          subjectId: null, teacherId: person.id, isGroupSubject: false,
        });
      }
      const [sM1, sM2, sT1] = await getTeacherSessionsForDate(person.id, MONDAY);

      await saveSessionRecords(sM1.id, [{ inscriptionId: inscription.id, status: 'absent' }], person.id);
      await saveSessionRecords(sM2.id, [{ inscriptionId: inscription.id, status: 'absent' }], person.id);

      const detail = await getSessionDetail(sT1.id);
      expect(detail.roster.find(r => r.inscriptionId === inscription.id)!.priorBlock).toBeNull();
    });

    it('ausencia justificada tras una presencia no bloquea', async () => {
      const { structure, person, schedule } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      for (const periodId of ['m2', 't1']) {
        await ScheduleEntry.create({
          scheduleId: schedule.id, day: 'Lunes', periodId,
          subjectId: null, teacherId: person.id, isGroupSubject: false,
        });
      }
      const [sM1, sM2, sT1] = await getTeacherSessionsForDate(person.id, MONDAY);

      await saveSessionRecords(sM1.id, [{ inscriptionId: inscription.id, status: 'present' }], person.id);
      await saveSessionRecords(sM2.id, [
        { inscriptionId: inscription.id, status: 'absent', reason: 'Justificado' },
      ], person.id);

      const detail = await getSessionDetail(sT1.id);
      expect(detail.roster.find(r => r.inscriptionId === inscription.id)!.priorBlock).toBeNull();
    });

    it('presente, ausente sin justificar y presente otra vez sí es jubilado', async () => {
      const { structure, person, schedule } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      for (const periodId of ['m2', 'm4', 't1']) {
        await ScheduleEntry.create({
          scheduleId: schedule.id, day: 'Lunes', periodId,
          subjectId: null, teacherId: person.id, isGroupSubject: false,
        });
      }
      const [sM1, sM2, sM4, sT1] = await getTeacherSessionsForDate(person.id, MONDAY);

      await saveSessionRecords(sM1.id, [{ inscriptionId: inscription.id, status: 'present' }], person.id);
      await saveSessionRecords(sM2.id, [{ inscriptionId: inscription.id, status: 'absent' }], person.id);
      await saveSessionRecords(sM4.id, [{ inscriptionId: inscription.id, status: 'present' }], person.id);

      const detail = await getSessionDetail(sT1.id);
      expect(detail.roster.find(r => r.inscriptionId === inscription.id)!.priorBlock?.kind).toBe('retired');
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
        { inscriptionId: inscription.id, status: 'kicked', reason: 'Pelea' },
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
      const [s1, s2] = await getTeacherSessionsForDate(person.id, MONDAY);
      await saveSessionRecords(s1.id, [
        { inscriptionId: inscription.id, status: 'kicked', reason: 'Pelea' },
      ], person.id);

      await expect(
        clearSessionBlock(s2.id, inscription.id, person.id, 'other', null)
      ).rejects.toThrow();
    });

    it('rechaza desbloquear cuando no hay bloqueo vivo', async () => {
      const { structure, person } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      const [s1] = await getTeacherSessionsForDate(person.id, MONDAY);

      await expect(
        clearSessionBlock(s1.id, inscription.id, person.id, 'parent_note', null)
      ).rejects.toThrow(/bloquead/);
      expect(await AttendanceRecord.count()).toBe(0);
    });
  });

  describe('getTeacherWeekTemplate', () => {
    it('agrupa los bloques por día con su nómina sin crear sesiones', async () => {
      const { structure, person, entry } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');

      const template = await getTeacherWeekTemplate(person.id, MONDAY);

      expect(template.days.Lunes).toHaveLength(1);
      expect(template.days.Martes).toHaveLength(0);
      expect(template.days.Lunes[0].scheduleEntryId).toBe(entry.id);
      expect(template.days.Lunes[0].roster.map(r => r.inscriptionId)).toEqual([inscription.id]);
      expect(await AttendanceSession.count()).toBe(0);
    });
  });

  describe('saveOfflineRecords', () => {
    it('crea la sesión por (bloque, fecha) y guarda lo tomado sin conexión', async () => {
      const { structure, person, entry } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');

      const result = await saveOfflineRecords(entry.id, MONDAY, [
        { inscriptionId: inscription.id, status: 'present', baseStatus: null },
      ], person.id);

      expect(result.created).toBe(1);
      expect(result.conflicts).toHaveLength(0);
      const session = await AttendanceSession.findOne({ where: { scheduleEntryId: entry.id, sessionDate: MONDAY } });
      expect(session!.id).toBe(result.sessionId);
      const record = await AttendanceRecord.findOne({ where: { sessionId: result.sessionId } });
      expect(record!.status).toBe('present');
    });

    it('conserva lo editado en el servidor mientras el teléfono estaba sin conexión', async () => {
      const { structure, person, entry } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription: first } = await setupStudent(structure, 'A');
      const { inscription: second } = await setupStudent(structure, 'B');
      const [session] = await getTeacherSessionsForDate(person.id, MONDAY);
      const { person: staff } = await createTestUser({ firstName: 'Control', lastName: 'Estudios' });
      // Control de Estudios fills one student while the teacher is offline.
      await saveSessionRecords(session.id, [
        { inscriptionId: second.id, status: 'excused', reason: 'Justificado' },
      ], staff.id);

      // The phone saw both students empty.
      const result = await saveOfflineRecords(entry.id, MONDAY, [
        { inscriptionId: first.id, status: 'present', baseStatus: null },
        { inscriptionId: second.id, status: 'absent', baseStatus: null },
      ], person.id);

      const detail = await getSessionDetail(session.id);
      const listNumber = detail.roster.findIndex(r => r.inscriptionId === second.id) + 1;
      expect(result.created).toBe(1);
      expect(result.conflicts).toEqual([{
        inscriptionId: second.id,
        listNumber,
        fullName: detail.roster[listNumber - 1].fullName,
        serverStatus: 'excused',
        serverReason: 'Justificado',
      }]);
      const kept = await AttendanceRecord.findOne({ where: { sessionId: session.id, inscriptionId: second.id } });
      expect(kept!.status).toBe('excused');
      expect(kept!.teacherId).toBe(staff.id);
    });

    it('no reporta conflicto si el servidor ya tiene el mismo valor', async () => {
      const { structure, person, entry } = await setupTeacherWithSchedule('Lunes', 'm1');
      const { inscription } = await setupStudent(structure, 'A');
      const [session] = await getTeacherSessionsForDate(person.id, MONDAY);
      await saveSessionRecords(session.id, [{ inscriptionId: inscription.id, status: 'present' }], person.id);

      const result = await saveOfflineRecords(entry.id, MONDAY, [
        { inscriptionId: inscription.id, status: 'present', baseStatus: null },
      ], person.id);

      expect(result.conflicts).toHaveLength(0);
      expect(result.unchanged).toBe(1);
    });

    it('descarta estudiantes que ya no están en la nómina', async () => {
      const { structure, person, entry } = await setupTeacherWithSchedule('Lunes', 'm1');
      await setupStudent(structure, 'A');

      const result = await saveOfflineRecords(entry.id, MONDAY, [
        { inscriptionId: 999999, status: 'present', baseStatus: null },
      ], person.id);

      expect(result.notInRoster).toEqual([999999]);
      expect(await AttendanceRecord.count()).toBe(0);
    });

    it('rechaza una fecha que no corresponde al día del bloque', async () => {
      const { person, entry } = await setupTeacherWithSchedule('Lunes', 'm1');

      await expect(saveOfflineRecords(entry.id, '2026-09-15', [], person.id))
        .rejects.toThrow('La fecha no corresponde al día de este bloque');
    });
  });
});
