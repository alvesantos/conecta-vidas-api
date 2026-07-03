import { Router } from 'express';
import { userController } from '../controllers/user.controller';
import { requireAuth } from '../middlewares/auth.middleware';
import { requireBotKey } from '../middlewares/botAuth.middleware';

const router = Router();

router.post('/', userController.create);
router.get('/me', requireAuth, userController.me);

// Rotas do bot do WhatsApp (autenticadas por X-Bot-Key). Declaradas antes
// de '/:id' para não serem capturadas por ele.
router.get('/by-cpf/:cpf', requireBotKey, userController.lookupByCpf);
router.post('/register-from-whatsapp', requireBotKey, userController.registerFromWhatsApp);

router.get('/', userController.findAll);
router.get('/vets', userController.listVets);
router.get('/:id', userController.findById);

export default router;
