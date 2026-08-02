import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { medicoService } from '../services/medico.service';
import logger from '../logger';

export const medicoController = {
  async getProfile(req: AuthRequest, res: Response) {
    try {
      const profile = await medicoService.getProfile(req.userId!);
      if (!profile) return res.status(404).json({ error: 'Perfil não encontrado.' });
      return res.json(profile);
    } catch (err) {
      logger.error('Erro ao buscar perfil médico', {
        message: err instanceof Error ? err.message : String(err),
        userId: req.userId,
      });
      return res.status(500).json({ error: 'Erro ao buscar perfil.' });
    }
  },

  async changePassword(req: AuthRequest, res: Response) {
    try {
      const { current_password, new_password } = req.body as Record<string, string>;
      if (!current_password || !new_password) {
        return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias.' });
      }
      if (new_password.length < 6) {
        return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
      }
      await medicoService.changePassword(req.userId!, current_password, new_password);
      return res.json({ message: 'Senha alterada com sucesso.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao alterar senha.';
      logger.error('Erro ao alterar senha do médico', { message, userId: req.userId });
      return res.status(400).json({ error: message });
    }
  },

  async listConsultations(req: AuthRequest, res: Response) {
    try {
      const consultations = await medicoService.findConsultations(
        req.userId!,
        req.query['date'] as string | undefined,
      );
      return res.json(consultations);
    } catch (err) {
      logger.error('Erro ao listar consultas médicas', {
        message: err instanceof Error ? err.message : String(err),
        userId: req.userId,
      });
      return res.status(500).json({ error: 'Erro ao listar consultas.' });
    }
  },
};
