import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { db } from '../database/knex';
import logger from '../logger';

export const patientController = {
  async records(req: AuthRequest, res: Response) {
    try {
      const records = await db('clinical_records as cr')
        .leftJoin('pets as p', 'cr.pet_id', 'p.id')
        .where('cr.user_id', req.userId!)
        .select(
          'cr.id', 'cr.kind', 'cr.pet_id', 'cr.blood_type', 'cr.allergies',
          'cr.comorbidities', 'cr.continuous_medications', 'cr.created_at',
          'p.name as pet_name',
        )
        .orderBy('cr.created_at', 'asc');
      return res.json(records);
    } catch (err) {
      logger.error('Erro ao listar prontuários do paciente', {
        message: err instanceof Error ? err.message : String(err),
        userId: req.userId,
      });
      return res.status(500).json({ error: 'Erro ao listar prontuários.' });
    }
  },

  async prescriptions(req: AuthRequest, res: Response) {
    try {
      const prescriptions = await db('prescriptions as pr')
        .leftJoin('users as professional', 'pr.vet_id', 'professional.id')
        .leftJoin('pets as p', 'pr.pet_id', 'p.id')
        .where('pr.user_id', req.userId!)
        .select(
          'pr.id', 'pr.kind', 'pr.pet_id', 'pr.content', 'pr.date',
          'professional.name as professional_name', 'p.name as pet_name',
        )
        .orderBy('pr.date', 'desc');
      return res.json(prescriptions);
    } catch (err) {
      logger.error('Erro ao listar receitas do paciente', {
        message: err instanceof Error ? err.message : String(err),
        userId: req.userId,
      });
      return res.status(500).json({ error: 'Erro ao listar receitas.' });
    }
  },
};
