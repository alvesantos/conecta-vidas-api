import { db } from '../database/knex';

export interface PlanEntitlement {
  /** Usuário possui assinatura ativa? */
  hasActivePlan: boolean;
  planId: string | null;
  planTitle: string | null;
  /** Total de consultas gratuitas que o plano concede por mês. */
  freeConsultations: number;
  /** Consultas gratuitas já consumidas no mês corrente. */
  usedFreeThisMonth: number;
  /** Cotas gratuitas restantes no mês. */
  remainingFree: number;
  /** A PRÓXIMA consulta agendada agora seria gratuita? */
  isNextConsultationFree: boolean;
}

/**
 * Retorna o intervalo [primeiro, último] dia do mês corrente no fuso de
 * São Paulo, no formato YYYY-MM-DD, para filtrar a coluna `date` (date-only).
 */
function getCurrentMonthRange(): { start: string; end: string } {
  const nowSp = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  );
  const year = nowSp.getFullYear();
  const month = nowSp.getMonth(); // 0-based
  const mm = String(month + 1).padStart(2, '0');
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

export const planEntitlementService = {
  /**
   * Calcula, no backend (fonte da verdade), se o usuário tem direito a uma
   * consulta gratuita agora — impedindo que quem já esgotou a cota do plano
   * receba consulta grátis, e que quem tem cota disponível seja cobrado.
   */
  async getForUser(userId: string): Promise<PlanEntitlement> {
    const subscription = await db('subscriptions as s')
      .join('plans as p', 's.plan_id', 'p.id')
      .where('s.user_id', userId)
      .andWhere('s.status', 'active')
      .select('p.id as plan_id', 'p.title', 'p.free_consultations')
      .first();

    const freeConsultations = subscription
      ? Number(subscription.free_consultations ?? 0)
      : 0;

    const { start, end } = getCurrentMonthRange();

    // Conta apenas consultas que efetivamente consumiram cota gratuita
    // (is_free = true) no mês, ignorando canceladas.
    const row = await db('consultations')
      .where('tutor_id', userId)
      .andWhere('is_free', true)
      .whereNot('status', 'cancelada')
      .whereBetween('date', [start, end])
      .count<{ cnt: string }[]>('id as cnt')
      .first();

    const usedFreeThisMonth = Number((row as { cnt?: string } | undefined)?.cnt ?? 0);
    const remainingFree = Math.max(0, freeConsultations - usedFreeThisMonth);

    return {
      hasActivePlan: !!subscription,
      planId: subscription?.plan_id ?? null,
      planTitle: subscription?.title ?? null,
      freeConsultations,
      usedFreeThisMonth,
      remainingFree,
      isNextConsultationFree: remainingFree > 0,
    };
  },
};
