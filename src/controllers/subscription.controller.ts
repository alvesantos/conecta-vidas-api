import type { Response } from 'express';
import { subscriptionService } from '../services/subscription.service';
import type { AuthRequest } from '../middlewares/auth.middleware';
import logger from '../logger';

export const subscriptionController = {
  async me(req: AuthRequest, res: Response) {
    try {
      if (!req.userId) return res.status(401).json({ error: 'Não autenticado.' });
      const subscription = await subscriptionService.findActiveByUser(req.userId);
      res.json(subscription ?? null);
    } catch (err) {
      logger.error('Erro ao buscar assinatura', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, userId: req.userId });
      res.status(500).json({ error: 'Erro ao buscar assinatura.' });
    }
  },

  async cancelMine(req: AuthRequest, res: Response) {
    try {
      if (!req.userId) return res.status(401).json({ error: 'Não autenticado.' });
      await subscriptionService.cancel(req.userId);
      res.status(204).end();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao cancelar assinatura.';
      logger.error('Erro ao cancelar assinatura', { message: err instanceof Error ? err.message : message, stack: err instanceof Error ? err.stack : undefined, userId: req.userId });
      res.status(400).json({ error: message });
    }
  },
};
