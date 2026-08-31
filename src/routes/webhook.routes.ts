import { Router } from "express";
import { webhookController } from "../controllers/webhook.controller";

const router = Router();

router.post('/pagarme', webhookController.handle);
router.post('/evolution', webhookController.evolutionHandle);

export default router;