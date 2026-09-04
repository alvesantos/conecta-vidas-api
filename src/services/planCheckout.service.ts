import { db } from '../database/knex';
import { asaasRequest, asaasConfigured } from './asaas/asaasClient';
import { ensureAsaasCustomer } from './asaas/asaasCustomer';

interface AsaasCheckoutResponse { id: string; link: string }

function platformUrl() {
  return process.env.PLATFORM_URL || 'http://localhost:3000';
}

export const planCheckoutService = {
  /**
   * Cria a assinatura local (pending_payment) e uma sessão de Asaas Checkout
   * (valor anual: Pix/boleto à vista, cartão parcelável em até 12x na própria
   * página do Asaas). Retorna a URL de checkout pra redirecionar o cliente.
   *
   * Usa /v3/checkouts (não /v3/payments) porque só o Checkout expõe o seletor
   * de parcelas no cartão via `installment.maxInstallmentCount` — a fatura
   * simples gerada por /payments não mostra opção de parcelamento.
   */
  async checkout(userId: string, planId: string) {
    if (!asaasConfigured) throw new Error('Pagamento de planos ainda não está configurado (ASAAS_API_KEY ausente).');

    const plan = await db('plans').where({ id: planId, is_active: true }).first();
    if (!plan) throw new Error('Plano não encontrado ou inativo.');

    const annualValue = Math.round(Number(plan.price) * 12 * 100) / 100;
    const customerId = await ensureAsaasCustomer(userId);

    const [subscription] = await db('subscriptions').insert({
      user_id: userId,
      plan_id: planId,
      paid_value: 0,
      status: 'pending_payment',
    }).returning('*');

    try {
      const checkout = await asaasRequest<AsaasCheckoutResponse>('/checkouts', {
        method: 'POST',
        body: {
          customer: customerId,
          // 'BOLETO' não é aceito pelo endpoint /checkouts (só pela fatura simples /payments).
          billingTypes: ['PIX', 'CREDIT_CARD'],
          chargeTypes: ['DETACHED', 'INSTALLMENT'],
          installment: { maxInstallmentCount: 12 },
          minutesToExpire: 1440,
          externalReference: subscription.id,
          items: [{
            name: `Plano ${plan.title} (anual)`,
            description: `Assinatura anual ConectaVidas · ${plan.title}`,
            quantity: 1,
            value: annualValue,
          }],
          callback: {
            successUrl: `${platformUrl()}/painel/cliente/assinatura?checkout=sucesso`,
            cancelUrl: `${platformUrl()}/assinaturas?checkout=cancelado`,
            expiredUrl: `${platformUrl()}/assinaturas?checkout=expirado`,
          },
        },
      });

      await db('subscriptions').where({ id: subscription.id }).update({
        asaas_checkout_id: checkout.id,
        checkout_url: checkout.link,
        updated_at: db.fn.now(),
      });

      return { subscriptionId: subscription.id, checkoutUrl: checkout.link };
    } catch (err) {
      // Sem checkout Asaas associado, essa linha pending_payment é só lixo — remove.
      await db('subscriptions').where({ id: subscription.id }).delete();
      throw err;
    }
  },

  /**
   * Chamado pelo webhook quando o pagamento é confirmado. `externalReference`
   * é o id da assinatura local (setado na criação do checkout). Ativa a
   * assinatura e cancela as demais ativas do usuário.
   */
  async activateByExternalReference(externalReference: string, asaasPaymentId: string, paidValue: number) {
    const subscription = await db('subscriptions').where({ id: externalReference }).first();
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
        asaas_payment_id: asaasPaymentId,
        started_at: trx.fn.now(),
        expires_at: expiresAt,
        updated_at: trx.fn.now(),
      });
    });
  },

  /** Chamado pelo webhook quando o pagamento falha/expira antes de ser confirmado. */
  async cancelByExternalReference(externalReference: string) {
    await db('subscriptions')
      .where({ id: externalReference })
      .whereIn('status', ['pending_payment'])
      .update({ status: 'canceled', canceled_at: db.fn.now(), updated_at: db.fn.now() });
  },
};
