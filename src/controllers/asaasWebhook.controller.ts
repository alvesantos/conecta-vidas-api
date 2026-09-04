import type { Request, Response } from 'express';
import { planCheckoutService } from '../services/planCheckout.service';
import logger from '../logger';

const CONFIRMED_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED']);
const CANCELED_EVENTS = new Set(['PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'PAYMENT_REFUNDED']);

export const asaasWebhookController = {
  async handle(req: Request, res: Response) {
    const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
    const receivedToken = req.headers['asaas-access-token'];
    if (expectedToken && receivedToken !== expectedToken) {
      logger.warn('Webhook Asaas com token inválido, ignorado');
      return res.status(401).json({ error: 'Token inválido.' });
    }

    // Responde 200 sempre que possível — Asaas reenvia (com backoff) em caso
    // de erro, o que pode duplicar processamento se a lógica não for idempotente.
    try {
      const event = req.body?.event as string | undefined;
      const payment = req.body?.payment as { id?: string; value?: number; externalReference?: string } | undefined;
      const externalReference = payment?.externalReference;

      if (externalReference && payment?.id && event && CONFIRMED_EVENTS.has(event)) {
        await planCheckoutService.activateByExternalReference(externalReference, payment.id, payment.value ?? 0);
      } else if (externalReference && event && CANCELED_EVENTS.has(event)) {
        await planCheckoutService.cancelByExternalReference(externalReference);
      } else {
        logger.info('Webhook Asaas recebido sem ação mapeada', { event, hasExternalReference: Boolean(externalReference) });
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      logger.error('Erro ao processar webhook do Asaas', { message: err instanceof Error ? err.message : String(err), body: req.body });
      return res.status(200).json({ received: true });
    }
  },
};
