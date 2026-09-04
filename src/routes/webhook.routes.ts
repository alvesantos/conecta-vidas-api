import { Router } from "express";
import { webhookController } from "../controllers/webhook.controller";
import { asaasWebhookController } from "../controllers/asaasWebhook.controller";

const router = Router();

router.post('/pagarme', webhookController.handle);
router.post('/evolution', webhookController.evolutionHandle);
router.post('/asaas', asaasWebhookController.handle);

export default router;