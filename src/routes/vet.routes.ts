import { Router } from 'express';
import { vetController } from '../controllers/vet.controller';
import { requireVet } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireVet);

router.get('/profile', vetController.getProfile);
router.put('/password', vetController.changePassword);
router.get('/consultations', vetController.listConsultations);
router.patch('/consultations/:id/status', vetController.updateConsultationStatus);
router.get('/balance', vetController.getBalance);

router.get('/responsibles', vetController.listResponsibles);
router.get('/responsibles/:id/pets', vetController.listResponsiblePets);
router.get('/prescriptions', vetController.listPrescriptions);
router.post('/prescriptions', vetController.createPrescription);
router.get('/prescriptions/:id', vetController.getPrescription);

export default router;
