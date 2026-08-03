import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { db } from '../database/knex';
import logger from '../logger';
import { logClinicalAccess } from '../services/clinicalAudit.service';

export const patientController = {
  async profile(req: AuthRequest, res: Response) {
    try {
      const user = await db('users')
        .where({ id: req.userId! })
        .select(
          'id', 'name', 'cpf', 'email', 'phone', 'birth_date', 'biological_sex',
          'zip_code', 'address', 'house_number', 'address_complement',
          'address_neighborhood', 'address_city', 'address_state',
        )
        .first();
      const health = await db('clinical_records')
        .where({ user_id: req.userId!, kind: 'humano' })
        .whereNull('pet_id')
        .select('blood_type', 'allergies', 'comorbidities', 'continuous_medications')
        .first();
      return res.json({ user, health });
    } catch {
      return res.status(500).json({ error: 'Erro ao buscar perfil.' });
    }
  },

  async updateHealth(req: AuthRequest, res: Response) {
    try {
      const body = req.body as Record<string, unknown>;
      const allowed = ['blood_type', 'allergies', 'comorbidities', 'continuous_medications'] as const;
      const patch: Record<string, unknown> = {
        updated_at: db.fn.now(),
      };
      for (const key of allowed) {
        if (body[key] !== undefined) {
          patch[key] = String(body[key]).trim() || null;
        }
      }
      const [record] = await db('clinical_records')
        .where({ user_id: req.userId!, kind: 'humano' })
        .whereNull('pet_id')
        .update(patch)
        .returning('*');
      if (!record) return res.status(404).json({ error: 'Prontuário humano não encontrado.' });
      await logClinicalAccess({
        actorUserId: req.userId!, patientUserId: req.userId!, action: 'update',
        resourceType: 'clinical_record', resourceId: record.id, context: 'humano',
      });
      return res.json(record);
    } catch {
      return res.status(500).json({ error: 'Erro ao atualizar ficha de saúde.' });
    }
  },

  async consents(req: AuthRequest, res: Response) {
    const rows = await db('user_consents')
      .where({ user_id: req.userId! })
      .select('id', 'consent_type', 'policy_version', 'granted_at', 'revoked_at', 'source')
      .orderBy('granted_at', 'desc');
    return res.json(rows);
  },

  async revokeConsent(req: AuthRequest, res: Response) {
    const id = req.params['id'] as string;
    const updated = await db('user_consents')
      .where({ id, user_id: req.userId! })
      .whereNull('revoked_at')
      .update({ revoked_at: db.fn.now() });
    if (!updated) return res.status(404).json({ error: 'Consentimento ativo não encontrado.' });
    return res.status(204).send();
  },

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
