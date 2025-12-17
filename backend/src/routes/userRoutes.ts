import { Router } from 'express';
import { searchUsers, getUserDetails, updateUser } from '@/controllers/userController';

const router = Router();

router.get('/', searchUsers);
router.get('/:id', getUserDetails);
router.put('/:id', updateUser);

export default router;
