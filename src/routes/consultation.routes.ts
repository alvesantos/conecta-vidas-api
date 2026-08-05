import { Router } from 'express';
import { consultationController } from '../controllers/consultation.controller';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/entitlement', consultationController.getEntitlement);
router.get('/quote', consultationController.getQuote);
router.post('/', consultationController.createConsultation);
router.get('/', consultationController.listTutorConsultations);

export default router;
