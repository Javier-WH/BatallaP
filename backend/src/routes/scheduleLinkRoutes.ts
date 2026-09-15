import { Router } from 'express';
import { listLinks, createLink, deleteLink } from '@/controllers/scheduleLinkController';

const router = Router();

router.get('/', listLinks);
router.post('/', createLink);
router.delete('/:id', deleteLink);

export default router;
