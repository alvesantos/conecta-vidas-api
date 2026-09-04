import type { Request, Response } from 'express';
import { planCheckoutService } from '../services/planCheckout.service';
import logger from '../logger';

const CONFIRMED_PAYMENT_EVENTS = new Set(['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED']);
const CANCELED_PAYMENT_EVENTS = new Set(['PAYMENT_OVERDUE', 'PAYMENT_DELETED', 'PAYMENT_REFUNDED']);

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

      // Caminho principal: eventos de Checkout, casados por checkout.id
      // (asaas_checkout_id) — ver nota em planCheckout.service.ts sobre por
      // que isso é mais confiável que payment.externalReference.
      const checkout = req.body?.checkout as { id?: string } | undefined;
      if (checkout?.id && event === 'CHECKOUT_PAID') {
        await planCheckoutService.activateByCheckoutId(checkout.id);
      } else if (checkout?.id && (event === 'CHECKOUT_CANCELED' || event === 'CHECKOUT_EXPIRED')) {
        await planCheckoutService.cancelByCheckoutId(checkout.id);
      }

      // Caminho de reforço: eventos de pagamento, quando o externalReference
      // veio preenchido (nem sempre acontece com pagamentos gerados a partir
      // de um checkout).
      const payment = req.body?.payment as { id?: string; externalReference?: string } | undefined;
      if (payment?.externalReference && payment?.id && event && CONFIRMED_PAYMENT_EVENTS.has(event)) {
        await planCheckoutService.activateByExternalReference(payment.externalReference, payment.id);
      } else if (payment?.externalReference && event && CANCELED_PAYMENT_EVENTS.has(event)) {
        await planCheckoutService.cancelByExternalReference(payment.externalReference);
      }

      if (!checkout?.id && !payment?.externalReference) {
        logger.info('Webhook Asaas recebido sem ação mapeada', { event });
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      logger.error('Erro ao processar webhook do Asaas', { message: err instanceof Error ? err.message : String(err), body: req.body });
      return res.status(200).json({ received: true });
    }
  },
};
