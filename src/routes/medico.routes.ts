import { Router } from 'express';
import { medicoController } from '../controllers/medico.controller';
import { requireMedico } from '../middlewares/auth.middleware';
import { queueController } from '../controllers/queue.controller';

const router = Router();

router.use(requireMedico);
router.get('/dashboard', medicoController.getDashboardStats);
router.get('/profile', medicoController.getProfile);
router.put('/password', medicoController.changePassword);
router.put('/financeiro', medicoController.updateFinanceiro);
router.get('/consultations', medicoController.listConsultations);
router.get('/queue', queueController.humanList);
router.post('/queue/:id/call', queueController.callHuman);
router.patch('/consultations/:id/status', medicoController.updateConsultationStatus);
router.patch('/consultations/:id/session', medicoController.saveConsultationSession);
router.patch('/availability', medicoController.setAvailability);
router.get('/records', medicoController.listRecords);
router.get('/records/:patientId', medicoController.getRecord);
router.get('/prescriptions', medicoController.listPrescriptions);
router.post('/prescriptions', medicoController.createPrescription);

export default router;
