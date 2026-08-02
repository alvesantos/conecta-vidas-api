import { Router } from 'express';
import { authController } from '../controllers/auth.controller';

const router = Router();

router.post('/login', authController.login);
router.post('/register', authController.register);
router.post('/register-professional', authController.registerProfessional);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

export default router;
