import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { planController } from '../controllers/plan.controller';
import { vetController } from '../controllers/vet.controller';
import { requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAdmin);

router.get('/users', adminController.listUsers);
router.put('/users/:id', adminController.updateUser);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.delete('/users/:id', adminController.deleteUser);
router.post('/users/:id/subscription', adminController.assignUserPlan);
router.delete('/users/:id/subscription', adminController.cancelUserPlan);

router.get('/dashboard', adminController.getDashboardStats);
router.get('/subscriptions', adminController.listSubscriptions);

router.get('/consultations', adminController.listConsultations);
router.patch('/consultations/:id/assign', adminController.assignVet);
router.patch('/consultations/:id/cancel', adminController.cancelConsultation);

router.get('/pets', adminController.listPets);
router.get('/pets/birthdays', adminController.listBirthdayPets);
router.get('/pets/:id', adminController.getPet);

router.get('/plans', planController.listAdmin);
router.post('/plans', planController.create);
router.put('/plans/:id', planController.update);
router.delete('/plans/:id', planController.delete);

router.get('/veterinarios', vetController.listVets);
router.post('/veterinarios', vetController.createVet);
router.put('/veterinarios/:id', vetController.updateVet);
router.delete('/veterinarios/:id', vetController.deleteVet);

export default router;
