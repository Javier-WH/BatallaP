import { Router } from 'express';
import * as AuthController from '@/controllers/authController';

const router = Router();

router.post('/login', AuthController.login);
router.post('/logout', AuthController.logout);
router.get('/me', AuthController.me);
router.post('/register', AuthController.register); // Remove in production or protect

export default router;
