import { Router } from 'express';
import { searchUsers, searchUsersStats, getUserDetails, updateUser, deleteUserAccount } from '@/controllers/userController';

const router = Router();

router.get('/', searchUsers);
// /search/stats must be registered before /:id to avoid the param route capturing "search".
router.get('/search/stats', searchUsersStats);
router.get('/:id', getUserDetails);
router.put('/:id', updateUser);
router.delete('/:id/account', deleteUserAccount);

export default router;
