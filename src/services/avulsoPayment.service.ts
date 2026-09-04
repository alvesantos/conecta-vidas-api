import { db } from '../database/knex';
import logger from '../logger';
import { isTrialVersion, AVULSO_PROFESSIONAL_SPLIT_PERCENT } from '../config/flags';

interface ChargeAvulsoInput {
  consultationId: string;
  userId: string;
  professionalId: string | null;
  grossAmount: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Pré-setado: registra o pagamento avulso com o split calculado (profissional/plataforma),
 * mas só realiza a cobrança de verdade quando THIS_IS_TRIAL_VERSION=false — o que ainda não
 * está implementado (depende do profissional ter CNPJ/recebedor configurado no Asaas Split).
 * Em trial version, não bloqueia o agendamento: registra como "trial_bypass" e segue.
 */
export const avulsoPaymentService = {
  async chargeAvulso({ consultationId, userId, professionalId, grossAmount }: ChargeAvulsoInput) {
    const professionalShare = round2(grossAmount * (AVULSO_PROFESSIONAL_SPLIT_PERCENT / 100));
    const platformShare = round2(grossAmount - professionalShare);

    if (isTrialVersion) {
      await db('payments').insert({
        consultation_id: consultationId,
        user_id: userId,
        professional_id: professionalId,
        kind: 'avulso',
        gross_amount: grossAmount,
        professional_share: professionalShare,
        platform_share: platformShare,
        provider: 'asaas',
        status: 'trial_bypass',
      });
      return { charged: false, reason: 'trial_version' as const };
    }

    logger.error('Tentativa de cobrança avulsa real sem implementação (THIS_IS_TRIAL_VERSION=false)', { consultationId });
    throw new Error('Cobrança avulsa real ainda não implementada. Configure o Asaas Split antes de desativar THIS_IS_TRIAL_VERSION.');
  },
};
