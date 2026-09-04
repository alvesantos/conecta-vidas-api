import logger from '../../logger';

const apiKey = process.env.RESEND_API_KEY || '';
const from = process.env.RESEND_FROM_EMAIL || 'ConectaVidas <atendimento@seudominio.com.br>';
const replyTo = process.env.RESEND_REPLY_TO || undefined;

export const resendConfigured = Boolean(apiKey);

/** Envia um único e-mail via Resend. Retorna false (sem lançar) se a API key não estiver configurada. */
export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  if (!apiKey || !to) return false;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resend respondeu ${response.status}: ${body}`);
  }
  return true;
}

interface BatchEmail { to: string; subject: string; html: string; text: string }

/** Envia até 100 e-mails distintos numa única chamada (limite da API de batch do Resend). */
export async function sendEmailBatch(emails: BatchEmail[]): Promise<number> {
  if (!apiKey || !emails.length) return 0;
  const response = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(emails.map(e => ({ from, to: [e.to], subject: e.subject, html: e.html, text: e.text, ...(replyTo ? { reply_to: replyTo } : {}) }))),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    logger.warn('Falha ao enviar lote de e-mails pelo Resend', { status: response.status, body });
    return 0;
  }
  return emails.length;
}
