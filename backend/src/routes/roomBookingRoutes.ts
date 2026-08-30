import { Router } from 'express';
import { listBookings, createBooking, updateBookingStatus, deleteBooking } from '@/controllers/roomBookingController';

const router = Router();

router.get('/', listBookings);
router.post('/', createBooking);
router.put('/:id', updateBookingStatus);
router.delete('/:id', deleteBooking);

export default router;
