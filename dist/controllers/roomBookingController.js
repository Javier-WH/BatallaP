"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBooking = exports.updateBookingStatus = exports.createBooking = exports.listBookings = void 0;
const sequelize_1 = require("sequelize");
const models_1 = require("../models/index.js");
// GET /api/room-bookings?schoolPeriodId=&status=&date=
const listBookings = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { schoolPeriodId, status, date } = req.query;
        const where = {};
        if (schoolPeriodId)
            where.schoolPeriodId = Number(schoolPeriodId);
        if (status)
            where.status = status;
        if (date)
            where.specificDate = date;
        const bookings = yield models_1.RoomBooking.findAll({ where, order: [['createdAt', 'DESC']] });
        // For pending requests, detect conflicts between them (same room+day+date+overlapping periods)
        if (status === 'pending') {
            for (const b of bookings) {
                const bPeriodIds = JSON.parse(b.periodIds || '[]');
                const conflicts = [];
                for (const other of bookings) {
                    if (other.id === b.id)
                        continue;
                    if (other.room !== b.room || other.day !== b.day || other.specificDate !== b.specificDate)
                        continue;
                    const otherPeriodIds = JSON.parse(other.periodIds || '[]');
                    if (bPeriodIds.some(p => otherPeriodIds.includes(p))) {
                        conflicts.push(other.id);
                    }
                }
                b.dataValues.conflictsWith = conflicts;
            }
        }
        return res.json(bookings);
    }
    catch (error) {
        console.error('[listBookings] Error:', error);
        return res.status(500).json({ message: 'Error al listar reservas de aulas' });
    }
});
exports.listBookings = listBookings;
// POST /api/room-bookings
const createBooking = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { room, day, periodIds, specificDate, teacherName, subjectName, reason, status, requestedBy, schoolPeriodId } = req.body;
        if (!room || !day || !periodIds || !teacherName || !subjectName || !schoolPeriodId) {
            return res.status(400).json({ message: 'Faltan campos requeridos' });
        }
        const newPeriodIds = Array.isArray(periodIds) ? periodIds : JSON.parse(periodIds);
        // Conflict check: only for bookings with a specific date and status 'approved'
        // (pending requests are allowed to conflict — CE will decide which to approve)
        if (specificDate && status === 'approved') {
            const existing = yield models_1.RoomBooking.findAll({
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
                const exPeriodIds = JSON.parse(ex.periodIds || '[]');
                const overlap = newPeriodIds.some(p => exPeriodIds.includes(p));
                if (overlap) {
                    return res.status(409).json({
                        message: `Conflicto: el aula ${room} ya tiene una reserva aprobada para ${day} ${specificDate} en bloques que coinciden (${exPeriodIds.filter(p => newPeriodIds.includes(p)).join(', ')})`,
                        conflictWith: { id: ex.id, teacherName: ex.teacherName, subjectName: ex.subjectName },
                    });
                }
            }
        }
        const booking = yield models_1.RoomBooking.create({
            room,
            day,
            periodIds: JSON.stringify(newPeriodIds),
            specificDate: specificDate !== null && specificDate !== void 0 ? specificDate : null,
            teacherName,
            subjectName,
            reason: reason !== null && reason !== void 0 ? reason : '',
            status: status !== null && status !== void 0 ? status : 'approved',
            requestedBy: requestedBy !== null && requestedBy !== void 0 ? requestedBy : null,
            schoolPeriodId,
        });
        return res.status(201).json(booking);
    }
    catch (error) {
        console.error('[createBooking] Error:', error);
        return res.status(500).json({ message: 'Error al crear reserva' });
    }
});
exports.createBooking = createBooking;
// PUT /api/room-bookings/:id — update status (approve/reject)
const updateBookingStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['approved', 'pending', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Status inválido' });
        }
        const booking = yield models_1.RoomBooking.findByPk(Number(id));
        if (!booking)
            return res.status(404).json({ message: 'Reserva no encontrada' });
        // If approving, check for conflicts with other approved bookings
        // and auto-reject conflicting pending requests
        if (status === 'approved' && booking.specificDate) {
            const newPeriodIds = JSON.parse(booking.periodIds || '[]');
            // 1. Check conflicts with already-approved bookings
            const approved = yield models_1.RoomBooking.findAll({
                where: {
                    id: { [sequelize_1.Op.ne]: booking.id },
                    room: booking.room,
                    day: booking.day,
                    specificDate: booking.specificDate,
                    schoolPeriodId: booking.schoolPeriodId,
                    status: 'approved',
                },
            });
            for (const ex of approved) {
                const exPeriodIds = JSON.parse(ex.periodIds || '[]');
                const overlap = newPeriodIds.some(p => exPeriodIds.includes(p));
                if (overlap) {
                    return res.status(409).json({
                        message: `Conflicto al aprobar: el aula ${booking.room} ya tiene una reserva aprobada para ${booking.day} ${booking.specificDate} (${ex.teacherName} — ${ex.subjectName})`,
                    });
                }
            }
            // 2. Auto-reject other pending requests that conflict with this one
            const pending = yield models_1.RoomBooking.findAll({
                where: {
                    id: { [sequelize_1.Op.ne]: booking.id },
                    room: booking.room,
                    day: booking.day,
                    specificDate: booking.specificDate,
                    schoolPeriodId: booking.schoolPeriodId,
                    status: 'pending',
                },
            });
            for (const p of pending) {
                const pPeriodIds = JSON.parse(p.periodIds || '[]');
                const overlap = newPeriodIds.some(pid => pPeriodIds.includes(pid));
                if (overlap) {
                    yield p.update({ status: 'rejected' });
                }
            }
        }
        yield booking.update({ status });
        return res.json(booking);
    }
    catch (error) {
        console.error('[updateBookingStatus] Error:', error);
        return res.status(500).json({ message: 'Error al actualizar reserva' });
    }
});
exports.updateBookingStatus = updateBookingStatus;
// DELETE /api/room-bookings/:id
const deleteBooking = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield models_1.RoomBooking.destroy({ where: { id: Number(id) } });
        return res.json({ message: 'Reserva eliminada' });
    }
    catch (error) {
        console.error('[deleteBooking] Error:', error);
        return res.status(500).json({ message: 'Error al eliminar reserva' });
    }
});
exports.deleteBooking = deleteBooking;
