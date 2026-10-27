import { Router } from 'express';
import { listBookings, getPendingBookingCount, createBooking, updateBookingStatus, deleteBooking } from '@/controllers/roomBookingController';

const router = Router();

router.get('/', listBookings);
router.get('/pending/count', getPendingBookingCount);
router.post('/', createBooking);
router.put('/:id', updateBookingStatus);
router.delete('/:id', deleteBooking);

export default router;
