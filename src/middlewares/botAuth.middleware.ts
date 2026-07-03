import type { Request, Response, NextFunction } from 'express';

/**
 * Protege as rotas consumidas pelo bot do WhatsApp (Evolution API/Typebot),
 * que não têm um JWT de usuário. Exige o header `X-Bot-Key` igual ao segredo
 * `BOT_API_KEY` do ambiente. Se a variável não estiver configurada, bloqueia
 * por segurança (fail-closed).
 */
export function requireBotKey(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.BOT_API_KEY;
  if (!expected) {
    return res.status(503).json({ error: 'Integração do bot não configurada.' });
  }

  const provided = req.headers['x-bot-key'];
  if (typeof provided !== 'string' || provided !== expected) {
    return res.status(401).json({ error: 'Chave de integração inválida.' });
  }

  next();
}
