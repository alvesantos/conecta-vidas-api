import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { schedulingController } from '../controllers/scheduling.controller';

const router = Router();
router.use(requireAuth);
router.get('/specialties', schedulingController.specialties);
router.get('/slots', schedulingController.slots);
router.get('/mine', schedulingController.mine);
router.put('/mine', schedulingController.replaceMine);
export default router;
