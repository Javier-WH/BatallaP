import { Router } from 'express';
import { searchUsers, getUserDetails, updateUser, deleteUserAccount } from '@/controllers/userController';

const router = Router();

router.get('/', searchUsers);
router.get('/:id', getUserDetails);
router.put('/:id', updateUser);
router.delete('/:id/account', deleteUserAccount);

export default router;
