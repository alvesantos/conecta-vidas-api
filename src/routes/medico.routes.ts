import { Router } from 'express';
import { medicoController } from '../controllers/medico.controller';
import { requireMedico } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireMedico);
router.get('/profile', medicoController.getProfile);
router.put('/password', medicoController.changePassword);
router.get('/consultations', medicoController.listConsultations);
router.get('/records', medicoController.listRecords);
router.get('/records/:patientId', medicoController.getRecord);
router.get('/prescriptions', medicoController.listPrescriptions);
router.post('/prescriptions', medicoController.createPrescription);

export default router;
