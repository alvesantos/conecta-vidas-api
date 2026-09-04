import crypto from 'node:crypto';
import { db } from '../database/knex';
import logger from '../logger';
import { sendEmail, resendConfigured } from './email/resendClient';
import { renderEmailLayout } from './email/emailLayout';
import { buildSampleTemplate, type MarketingTemplateKey } from './email/templates';

// Fixo por pedido do time: todo envio de teste de template vai sempre pra este e-mail,
// independente de quem disparar no painel admin.
const TEST_RECIPIENT = 'ebagabe.2025@gmail.com';

function apiPublicUrl() {
  return process.env.API_PUBLIC_URL || 'http://localhost:3001';
}

function platformUrl() {
  return process.env.PLATFORM_URL || 'http://localhost:3000';
}

function unsubscribeToken(userId: string) {
  return crypto.createHmac('sha256', process.env.JWT_SECRET ?? '').update(userId).digest('hex');
}

function unsubscribeUrl(userId: string) {
  return `${apiPublicUrl()}/api/marketing/unsubscribe?uid=${userId}&token=${unsubscribeToken(userId)}`;
}

export const marketingEmailService = {
  unsubscribeToken,

  /** Verifica o token do link de descadastro e desativa e-mails de marketing pro usuário. */
  async unsubscribe(userId: string, token: string) {
    const expected = unsubscribeToken(userId);
    const valid = expected.length === token.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
    if (!valid) return false;
    await db('users').where({ id: userId }).update({ marketing_opt_out: true, updated_at: db.fn.now() });
    return true;
  },

  async listRecipients() {
    return db('users')
      .where({ type: 'tutor', status: 'active', marketing_opt_out: false })
      .whereNotNull('email')
      .select('id', 'name', 'email');
  },

  /** Dispara uma campanha simples (mesmo conteúdo pra todos, só o nome muda) pra toda a base de clientes ativa que não fez opt-out. */
  async sendCampaign(subject: string, heading: string, bodyParagraphs: string[]) {
    if (!resendConfigured) return { total: 0, sent: 0, skipped: 'resend_not_configured' as const };

    const recipients = await this.listRecipients();
    let sent = 0;
    for (const user of recipients) {
      const bodyHtml =
        `<p style="margin:0 0 16px;">Olá, ${user.name?.split(' ')[0] || ''}!</p>` +
        bodyParagraphs.map((p: string) => `<p style="margin:0 0 16px;">${p}</p>`).join('');
      const html = renderEmailLayout({
        heading,
        bodyHtml,
        ctaLabel: 'Acessar a plataforma',
        ctaUrl: platformUrl(),
        unsubscribeUrl: unsubscribeUrl(user.id),
      });
      const text = `Olá, ${user.name}!\n\n${bodyParagraphs.join('\n\n')}\n\nAcesse: ${platformUrl()}\n\nNão quer mais receber? ${unsubscribeUrl(user.id)}`;
      try {
        const delivered = await sendEmail(user.email, subject, html, text);
        if (delivered) sent++;
      } catch (err) {
        logger.warn('Falha ao enviar e-mail de marketing', { userId: user.id, message: err instanceof Error ? err.message : String(err) });
      }
    }
    return { total: recipients.length, sent };
  },

  /** Manda um template com dados de exemplo pro e-mail fixo de teste, pra visualizar o design. */
  async sendTestEmail(templateKey: MarketingTemplateKey) {
    if (!resendConfigured) return { sent: false, reason: 'resend_not_configured' as const };
    const rendered = buildSampleTemplate(templateKey, 'Cliente Teste');
    const html = renderEmailLayout({
      heading: rendered.heading,
      bodyHtml: rendered.bodyHtml,
      ctaLabel: rendered.ctaLabel,
      ctaUrl: platformUrl(),
    });
    const text = `${rendered.heading}\n\n(pré-visualização em texto simples não disponível para este template de teste — veja o HTML)`;
    const delivered = await sendEmail(TEST_RECIPIENT, `[TESTE] ${rendered.subject}`, html, text);
    return { sent: delivered };
  },
};
