import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.post('/', userController.create);
router.get('/me', requireAuth, userController.me);
router.get('/', userController.findAll);
router.get('/vets', userController.listVets);
router.get('/:id', userController.findById);

export default router;
