import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { patientController } from '../controllers/patient.controller';
import { triageController } from '../controllers/triage.controller';
import { queueController } from '../controllers/queue.controller';
import { planCheckoutController } from '../controllers/planCheckout.controller';

const router = Router();

router.use(requireAuth);
router.get('/triage/symptoms', triageController.catalog);
router.post('/triages', triageController.start);
router.post('/triages/:id/complete', triageController.complete);
router.get('/queue/:consultationId', queueController.status);
router.get('/queue/:consultationId/events', queueController.events);
router.post('/queue/:consultationId/leave', queueController.leave);
router.post('/plans/:id/checkout', planCheckoutController.checkout);
router.get('/medication-reminders', patientController.medicationReminders);
router.post('/medication-reminders', patientController.createMedicationReminder);
router.delete('/medication-reminders/:id', patientController.deleteMedicationReminder);
router.get('/dependents', patientController.dependents);
router.post('/dependents', patientController.createDependent);
router.put('/dependents/:id', patientController.updateDependent);
router.delete('/dependents/:id', patientController.deleteDependent);
router.get('/profile', patientController.profile);
router.put('/health', patientController.updateHealth);
router.get('/consents', patientController.consents);
router.post('/consents/:id/revoke', patientController.revokeConsent);
router.get('/records', patientController.records);
router.get('/prescriptions', patientController.prescriptions);
router.get('/timeline', patientController.timeline);

export default router;
