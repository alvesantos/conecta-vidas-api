import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { db } from '../database/knex';
import logger from '../logger';
import { logClinicalAccess } from '../services/clinicalAudit.service';

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
      await Promise.all(
        (records as Array<{ id: string; kind: 'humano' | 'veterinario' }>).map(record =>
          logClinicalAccess({
            actorUserId: req.userId!, patientUserId: req.userId!, action: 'read',
            resourceType: 'clinical_record', resourceId: record.id, context: record.kind,
          }),
        ),
      );
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
      await Promise.all(
        (prescriptions as Array<{ id: string; kind: 'humana' | 'veterinaria' }>).map(item =>
          logClinicalAccess({
            actorUserId: req.userId!, patientUserId: req.userId!, action: 'read',
            resourceType: 'prescription', resourceId: item.id,
            context: item.kind === 'humana' ? 'humano' : 'veterinario',
          }),
        ),
      );
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
