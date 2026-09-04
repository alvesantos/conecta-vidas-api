import type { Request, Response } from 'express';
import { marketingEmailService } from '../services/marketingEmail.service';
import { MARKETING_TEMPLATE_KEYS, type MarketingTemplateKey } from '../services/email/templates';
import logger from '../logger';

const UNSUBSCRIBE_PAGE = (message: string) => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" /><title>ConectaVidas</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f3f4f6;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
  <div style="background:#fff;border-radius:16px;padding:40px;max-width:420px;text-align:center;">
    <h1 style="color:#01193A;font-size:20px;">ConectaVidas</h1>
    <p style="color:#374151;font-size:15px;">${message}</p>
  </div>
</body></html>`;

export const marketingController = {
  async unsubscribe(req: Request, res: Response) {
    const uid = req.query['uid'] as string;
    const token = req.query['token'] as string;
    if (!uid || !token) return res.status(400).send(UNSUBSCRIBE_PAGE('Link inválido.'));
    try {
      const ok = await marketingEmailService.unsubscribe(uid, token);
      if (!ok) return res.status(400).send(UNSUBSCRIBE_PAGE('Link inválido ou expirado.'));
      return res.send(UNSUBSCRIBE_PAGE('Você foi descadastrado com sucesso. Não enviaremos mais e-mails de marketing pra você.'));
    } catch (err) {
      logger.error('Erro ao processar descadastro de marketing', { message: err instanceof Error ? err.message : String(err), uid });
      return res.status(500).send(UNSUBSCRIBE_PAGE('Não foi possível processar seu pedido. Tente novamente mais tarde.'));
    }
  },

  async testSend(req: Request, res: Response) {
    try {
      const { template } = req.body as { template?: string };
      if (!template || !MARKETING_TEMPLATE_KEYS.includes(template as MarketingTemplateKey)) {
        return res.status(400).json({ error: `template inválido. Use: ${MARKETING_TEMPLATE_KEYS.join(', ')}` });
      }
      const result = await marketingEmailService.sendTestEmail(template as MarketingTemplateKey);
      if (!result.sent) return res.status(400).json({ error: 'Resend não configurado ou envio falhou.' });
      return res.json({ success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar e-mail de teste.';
      logger.error('Erro ao enviar e-mail de teste de template', { message });
      return res.status(500).json({ error: message });
    }
  },

  async sendCampaign(req: Request, res: Response) {
    try {
      const { subject, heading, body } = req.body as { subject?: string; heading?: string; body?: string | string[] };
      if (!subject || !heading || !body) {
        return res.status(400).json({ error: 'subject, heading e body são obrigatórios.' });
      }
      const paragraphs = Array.isArray(body) ? body : [body];
      const result = await marketingEmailService.sendCampaign(subject, heading, paragraphs);
      return res.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar campanha.';
      logger.error('Erro ao enviar campanha de marketing', { message });
      return res.status(500).json({ error: message });
    }
  },
};
