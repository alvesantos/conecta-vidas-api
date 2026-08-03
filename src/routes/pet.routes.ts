import { Router } from 'express';
import { petController } from '../controllers/pet.controller';
import { uploadPetAvatar } from '../middlewares/upload';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.post('/', requireAuth, uploadPetAvatar, petController.create);
router.get('/my', requireAuth, petController.findMine);
router.get('/me', requireAuth, petController.findMine);
router.get('/user/:userId', petController.findByUser);
router.get('/tutor/:tutorId', petController.findByUser);
router.get('/:id', petController.findById);
router.put('/:id', requireAuth, uploadPetAvatar, petController.update);
router.delete('/:id', requireAuth, petController.remove);

export default router;
