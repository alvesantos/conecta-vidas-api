import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { patientController } from '../controllers/patient.controller';

const router = Router();

router.use(requireAuth);
router.get('/profile', patientController.profile);
router.put('/health', patientController.updateHealth);
router.get('/consents', patientController.consents);
router.post('/consents/:id/revoke', patientController.revokeConsent);
router.get('/records', patientController.records);
router.get('/prescriptions', patientController.prescriptions);

export default router;
