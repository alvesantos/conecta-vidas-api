import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { planCheckoutService } from '../services/planCheckout.service';
import logger from '../logger';

export const planCheckoutController = {
  async checkout(req: AuthRequest, res: Response) {
    try {
      const planId = req.params['id'] as string;
      const result = await planCheckoutService.checkout(req.userId!, planId);
      return res.status(201).json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao iniciar pagamento do plano.';
      logger.error('Erro ao criar checkout de plano', { message, userId: req.userId, planId: req.params['id'] });
      return res.status(400).json({ error: message });
    }
  },
};
