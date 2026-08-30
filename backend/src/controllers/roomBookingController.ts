import { Request, Response } from 'express';
import { Op } from 'sequelize';
import { RoomBooking } from '@/models';

// GET /api/room-bookings?schoolPeriodId=&status=&date=
export const listBookings = async (req: Request, res: Response) => {
  try {
    const { schoolPeriodId, status, date } = req.query;
    const where: any = {};
    if (schoolPeriodId) where.schoolPeriodId = Number(schoolPeriodId);
    if (status) where.status = status;
    if (date) where.specificDate = date;

    const bookings = await RoomBooking.findAll({ where, order: [['createdAt', 'DESC']] });

    // For pending requests, detect conflicts between them (same room+day+date+overlapping periods)
    if (status === 'pending') {
      for (const b of bookings) {
        const bPeriodIds: string[] = JSON.parse(b.periodIds || '[]');
        const conflicts: number[] = [];
        for (const other of bookings) {
          if (other.id === b.id) continue;
          if (other.room !== b.room || other.day !== b.day || other.specificDate !== b.specificDate) continue;
          const otherPeriodIds: string[] = JSON.parse(other.periodIds || '[]');
          if (bPeriodIds.some(p => otherPeriodIds.includes(p))) {
            conflicts.push(other.id);
          }
        }
        (b as any).dataValues.conflictsWith = conflicts;
      }
    }

    return res.json(bookings);
  } catch (error) {
    console.error('[listBookings] Error:', error);
    return res.status(500).json({ message: 'Error al listar reservas de aulas' });
  }
};

// POST /api/room-bookings
export const createBooking = async (req: Request, res: Response) => {
  try {
    const { room, day, periodIds, specificDate, teacherName, subjectName, reason, status, requestedBy, schoolPeriodId } = req.body;
    if (!room || !day || !periodIds || !teacherName || !subjectName || !schoolPeriodId) {
      return res.status(400).json({ message: 'Faltan campos requeridos' });
    }
    const newPeriodIds: string[] = Array.isArray(periodIds) ? periodIds : JSON.parse(periodIds);

    // Conflict check: only for bookings with a specific date and status 'approved'
    // (pending requests are allowed to conflict — CE will decide which to approve)
    if (specificDate && status === 'approved') {
      const existing = await RoomBooking.findAll({
        where: {
          room,
          day,
          specificDate,
          schoolPeriodId: Number(schoolPeriodId),
          status: 'approved',
        },
      });
      // Check for overlapping periodIds
      for (const ex of existing) {
        const exPeriodIds: string[] = JSON.parse(ex.periodIds || '[]');
        const overlap = newPeriodIds.some(p => exPeriodIds.includes(p));
        if (overlap) {
          return res.status(409).json({
            message: `Conflicto: el aula ${room} ya tiene una reserva aprobada para ${day} ${specificDate} en bloques que coinciden (${exPeriodIds.filter(p => newPeriodIds.includes(p)).join(', ')})`,
            conflictWith: { id: ex.id, teacherName: ex.teacherName, subjectName: ex.subjectName },
          });
        }
      }
    }

    const booking = await RoomBooking.create({
      room,
      day,
      periodIds: JSON.stringify(newPeriodIds),
      specificDate: specificDate ?? null,
      teacherName,
      subjectName,
      reason: reason ?? '',
      status: status ?? 'approved',
      requestedBy: requestedBy ?? null,
      schoolPeriodId,
    });
    return res.status(201).json(booking);
  } catch (error) {
    console.error('[createBooking] Error:', error);
    return res.status(500).json({ message: 'Error al crear reserva' });
  }
};

// PUT /api/room-bookings/:id — update status (approve/reject)
export const updateBookingStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['approved', 'pending', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status inválido' });
    }
    const booking = await RoomBooking.findByPk(Number(id));
    if (!booking) return res.status(404).json({ message: 'Reserva no encontrada' });

    // If approving, check for conflicts with other approved bookings
    // and auto-reject conflicting pending requests
    if (status === 'approved' && booking.specificDate) {
      const newPeriodIds: string[] = JSON.parse(booking.periodIds || '[]');

      // 1. Check conflicts with already-approved bookings
      const approved = await RoomBooking.findAll({
        where: {
          id: { [Op.ne]: booking.id },
          room: booking.room,
          day: booking.day,
          specificDate: booking.specificDate,
          schoolPeriodId: booking.schoolPeriodId,
          status: 'approved',
        },
      });
      for (const ex of approved) {
        const exPeriodIds: string[] = JSON.parse(ex.periodIds || '[]');
        const overlap = newPeriodIds.some(p => exPeriodIds.includes(p));
        if (overlap) {
          return res.status(409).json({
            message: `Conflicto al aprobar: el aula ${booking.room} ya tiene una reserva aprobada para ${booking.day} ${booking.specificDate} (${ex.teacherName} — ${ex.subjectName})`,
          });
        }
      }

      // 2. Auto-reject other pending requests that conflict with this one
      const pending = await RoomBooking.findAll({
        where: {
          id: { [Op.ne]: booking.id },
          room: booking.room,
          day: booking.day,
          specificDate: booking.specificDate,
          schoolPeriodId: booking.schoolPeriodId,
          status: 'pending',
        },
      });
      for (const p of pending) {
        const pPeriodIds: string[] = JSON.parse(p.periodIds || '[]');
        const overlap = newPeriodIds.some(pid => pPeriodIds.includes(pid));
        if (overlap) {
          await p.update({ status: 'rejected' });
        }
      }
    }

    await booking.update({ status });
    return res.json(booking);
  } catch (error) {
    console.error('[updateBookingStatus] Error:', error);
    return res.status(500).json({ message: 'Error al actualizar reserva' });
  }
};

// DELETE /api/room-bookings/:id
export const deleteBooking = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await RoomBooking.destroy({ where: { id: Number(id) } });
    return res.json({ message: 'Reserva eliminada' });
  } catch (error) {
    console.error('[deleteBooking] Error:', error);
    return res.status(500).json({ message: 'Error al eliminar reserva' });
  }
};
