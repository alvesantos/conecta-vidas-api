import { db } from '../database/knex';
import { asaasRequest, asaasConfigured } from './asaas/asaasClient';
import { ensureAsaasCustomer } from './asaas/asaasCustomer';

interface AsaasPaymentResponse { id: string; invoiceUrl: string }

function dueDateInDays(days: number): string {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

export const planCheckoutService = {
  /**
   * Cria a assinatura local (pending_payment) e o pagamento no Asaas (valor anual,
   * checkout hospedado: Pix/boleto à vista, cartão parcelável na própria página do Asaas).
   * Retorna a URL de checkout pra redirecionar o cliente.
   */
  async checkout(userId: string, planId: string) {
    if (!asaasConfigured) throw new Error('Pagamento de planos ainda não está configurado (ASAAS_API_KEY ausente).');

    const plan = await db('plans').where({ id: planId, is_active: true }).first();
    if (!plan) throw new Error('Plano não encontrado ou inativo.');

    const annualValue = Number(plan.price) * 12;
    const customerId = await ensureAsaasCustomer(userId);

    const [subscription] = await db('subscriptions').insert({
      user_id: userId,
      plan_id: planId,
      paid_value: 0,
      status: 'pending_payment',
    }).returning('*');

    try {
      const payment = await asaasRequest<AsaasPaymentResponse>('/payments', {
        method: 'POST',
        body: {
          customer: customerId,
          billingType: 'UNDEFINED',
          value: annualValue,
          dueDate: dueDateInDays(3),
          description: `Plano ${plan.title} (anual) · ConectaVidas`,
          externalReference: subscription.id,
        },
      });

      await db('subscriptions').where({ id: subscription.id }).update({
        asaas_payment_id: payment.id,
        checkout_url: payment.invoiceUrl,
        updated_at: db.fn.now(),
      });

      return { subscriptionId: subscription.id, checkoutUrl: payment.invoiceUrl };
    } catch (err) {
      // Sem pagamento Asaas associado, essa linha pending_payment é só lixo — remove.
      await db('subscriptions').where({ id: subscription.id }).delete();
      throw err;
    }
  },

  /** Chamado pelo webhook quando o pagamento é confirmado. Ativa a assinatura e cancela as demais do usuário. */
  async activateByAsaasPaymentId(asaasPaymentId: string, paidValue: number) {
    const subscription = await db('subscriptions').where({ asaas_payment_id: asaasPaymentId }).first();
    if (!subscription || subscription.status === 'active') return;

    await db.transaction(async (trx) => {
      await trx('subscriptions')
        .where({ user_id: subscription.user_id, status: 'active' })
        .update({ status: 'canceled', canceled_at: trx.fn.now(), updated_at: trx.fn.now() });

      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      await trx('subscriptions').where({ id: subscription.id }).update({
        status: 'active',
        paid_value: paidValue,
        started_at: trx.fn.now(),
        expires_at: expiresAt,
        updated_at: trx.fn.now(),
      });
    });
  },

  /** Chamado pelo webhook quando o pagamento falha/expira antes de ser confirmado. */
  async cancelByAsaasPaymentId(asaasPaymentId: string) {
    await db('subscriptions')
      .where({ asaas_payment_id: asaasPaymentId })
      .whereIn('status', ['pending_payment'])
      .update({ status: 'canceled', canceled_at: db.fn.now(), updated_at: db.fn.now() });
  },
};
