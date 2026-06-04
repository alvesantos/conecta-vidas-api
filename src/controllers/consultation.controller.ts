import type { Request, Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { consultationService } from '../services/consultation.service';
import logger from '../logger';

export const consultationController = {
  async createConsultation(req: AuthRequest, res: Response) {
    try {
      const { pet_id, date, time, notes } = req.body as Record<string, string>;
      if (!date || !time) {
        return res.status(400).json({ error: 'Data e horário são obrigatórios.' });
      }

      const consultation = await consultationService.create({
        tutor_id: req.userId!,
        vet_id: null,
        pet_id: pet_id || null,
        date,
        time,
        notes,
      });

      res.status(201).json(consultation);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao agendar consulta.';
      logger.error('Erro ao agendar consulta', { message: msg, userId: req.userId });
      res.status(400).json({ error: msg });
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
