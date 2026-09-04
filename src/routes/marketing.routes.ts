import { Router } from 'express';
import { marketingController } from '../controllers/marketing.controller';

const router = Router();

// Pública: acessada a partir do link de descadastro no rodapé dos e-mails de marketing.
router.get('/unsubscribe', marketingController.unsubscribe);

export default router;
