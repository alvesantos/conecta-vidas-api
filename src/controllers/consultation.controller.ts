import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { consultationService } from '../services/consultation.service';
import { planEntitlementService } from '../services/planEntitlement.service';
import logger from '../logger';

export const consultationController = {
  async createConsultation(req: AuthRequest, res: Response) {
    try {
      const { pet_id, date, time, notes } = req.body as Record<string, string>;
      if (!date || !time) {
        return res.status(400).json({ error: 'Data e horário são obrigatórios.' });
      }

      // Regra de plano decidida no backend (fonte da verdade): se ainda há
      // cota gratuita no mês, esta consulta é registrada como gratuita.
      const entitlement = await planEntitlementService.getForUser(req.userId!);

      const consultation = await consultationService.create({
        tutor_id: req.userId!,
        vet_id: null,
        pet_id: pet_id || null,
        date,
        time,
        notes,
        is_free: entitlement.isNextConsultationFree,
      });

      res.status(201).json({ ...consultation, entitlement });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao agendar consulta.';
      logger.error('Erro ao agendar consulta', { message: msg, userId: req.userId });
      res.status(400).json({ error: msg });
    }
  },

  async getEntitlement(req: AuthRequest, res: Response) {
    try {
      const entitlement = await planEntitlementService.getForUser(req.userId!);
      res.json(entitlement);
    } catch (err) {
      logger.error('Erro ao consultar entitlement de plano', {
        message: err instanceof Error ? err.message : String(err),
        userId: req.userId,
      });
      res.status(500).json({ error: 'Erro ao verificar plano.' });
    }
  },

  async listTutorConsultations(req: AuthRequest, res: Response) {
    try {
      const consultations = await consultationService.findByTutor(req.userId!);
      res.json(consultations);
    } catch (err) {
      logger.error('Erro ao listar consultas do tutor', { message: err instanceof Error ? err.message : String(err), userId: req.userId });
      res.status(500).json({ error: 'Erro ao listar consultas.' });
    }
  }
};
