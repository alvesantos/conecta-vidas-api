import { Router } from 'express';
import { vetController } from '../controllers/vet.controller';
import { requireVet } from '../middlewares/auth.middleware';
import { queueController } from '../controllers/queue.controller';

const router = Router();

router.use(requireVet);

router.get('/dashboard', vetController.getDashboardStats);
router.get('/profile', vetController.getProfile);
router.put('/password', vetController.changePassword);
router.put('/financeiro', vetController.updateFinanceiro);
router.get('/consultations', vetController.listConsultations);
router.get('/queue', queueController.veterinaryList);
router.post('/queue/:id/call', queueController.callVeterinary);
router.patch('/consultations/:id/status', vetController.updateConsultationStatus);
router.patch('/consultations/:id/session', vetController.saveConsultationSession);
router.get('/balance', vetController.getBalance);

router.get('/responsibles', vetController.listResponsibles);
router.get('/responsibles/:id/pets', vetController.listResponsiblePets);
router.get('/prescriptions', vetController.listPrescriptions);
router.post('/prescriptions', vetController.createPrescription);
router.get('/prescriptions/:id', vetController.getPrescription);
router.delete('/prescriptions/:id', vetController.deletePrescription);

router.get('/medical-records/tutors', vetController.listMedicalRecordTutors);
router.get('/medical-records/tutor/:tutorId', vetController.listMedicalRecordsByTutor);
router.get('/medical-records/:id', vetController.getMedicalRecord);
router.put('/medical-records/:id', vetController.updateMedicalRecord);

export default router;
