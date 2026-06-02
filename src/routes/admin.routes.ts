import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { planController } from '../controllers/plan.controller';
import { vetController } from '../controllers/vet.controller';
import { requireAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.use(requireAdmin);

router.get('/users', adminController.listUsers);
router.put('/users/:id', adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);
router.post('/users/:id/subscription', adminController.assignUserPlan);
router.delete('/users/:id/subscription', adminController.cancelUserPlan);

router.get('/pets', adminController.listPets);
router.get('/pets/birthdays', adminController.listBirthdayPets);
router.get('/pets/:id', adminController.getPet);

router.get('/plans', planController.listAdmin);
router.post('/plans', planController.create);
router.put('/plans/:id', planController.update);

router.get('/veterinarios', vetController.listVets);
router.post('/veterinarios', vetController.createVet);

export default router;
