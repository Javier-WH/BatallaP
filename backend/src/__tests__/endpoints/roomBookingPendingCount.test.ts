import request from 'supertest';
import app from '@/app';
import { RoomBooking } from '@/models/index';

const booking = (overrides: Partial<any> = {}) => ({
  room: 'Aula 1',
  day: 'Lunes',
  periodIds: JSON.stringify(['m1']),
  specificDate: '2026-11-02',
  teacherName: 'Profesor Prueba',
  subjectName: 'Matemáticas',
  status: 'pending' as const,
  schoolPeriodId: 1,
  ...overrides,
});

describe('GET /api/room-bookings/pending/count', () => {
  it('cuenta solo las solicitudes pendientes', async () => {
    await RoomBooking.bulkCreate([
      booking(),
      booking({ room: 'Aula 2' }),
      booking({ status: 'approved' }),
      booking({ status: 'rejected' }),
    ]);

    const res = await request(app).get('/api/room-bookings/pending/count').expect(200);
    expect(res.body.count).toBe(2);
  });

  it('filtra por período escolar', async () => {
    await RoomBooking.bulkCreate([
      booking({ schoolPeriodId: 1 }),
      booking({ schoolPeriodId: 2 }),
      booking({ schoolPeriodId: 2, room: 'Aula 3' }),
    ]);

    const p1 = await request(app).get('/api/room-bookings/pending/count').query({ schoolPeriodId: 1 }).expect(200);
    const p2 = await request(app).get('/api/room-bookings/pending/count').query({ schoolPeriodId: 2 }).expect(200);
    expect(p1.body.count).toBe(1);
    expect(p2.body.count).toBe(2);
  });

  it('baja al aprobar o rechazar una solicitud', async () => {
    const created = await RoomBooking.create(booking());
    expect((await request(app).get('/api/room-bookings/pending/count')).body.count).toBe(1);

    await request(app).put(`/api/room-bookings/${created.id}`).send({ status: 'rejected' }).expect(200);
    expect((await request(app).get('/api/room-bookings/pending/count')).body.count).toBe(0);
  });
});
