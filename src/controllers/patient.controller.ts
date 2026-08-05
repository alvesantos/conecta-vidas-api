import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { db } from '../database/knex';
import logger from '../logger';
import { logClinicalAccess } from '../services/clinicalAudit.service';

export const patientController = {
  async medicationReminders(req: AuthRequest, res: Response) {
    const rows = await db('medication_reminders')
      .where({ user_id: req.userId! })
      .whereNull('deleted_at')
      .select('*')
      .orderBy('time');
    return res.json(rows);
  },

  async createMedicationReminder(req: AuthRequest, res: Response) {
    try {
      const body = req.body as Record<string, unknown>;
      const kind = body.kind === 'veterinario' ? 'veterinario' : 'humano';
      const petId = kind === 'veterinario' ? String(body.pet_id || '') : null;
      const dependentId = kind === 'humano' && body.dependent_id ? String(body.dependent_id) : null;
      const name = String(body.name || '').trim();
      const time = String(body.time || '');
      if (!name || !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
        return res.status(400).json({ error: 'Medicamento e horário são obrigatórios.' });
      }
      if (kind === 'veterinario') {
        const pet = await db('pets').where({ id: petId, user_id: req.userId! }).whereNull('deleted_at').first();
        if (!pet) return res.status(400).json({ error: 'Pet inválido para este lembrete.' });
      }
      if (dependentId) {
        const dependent = await db('human_dependents')
          .where({ id: dependentId, user_id: req.userId! })
          .whereNull('deleted_at')
          .first();
        if (!dependent) return res.status(400).json({ error: 'Dependente inválido para este lembrete.' });
      }
      const [created] = await db('medication_reminders').insert({
        user_id: req.userId!,
        kind,
        pet_id: petId,
        dependent_id: dependentId,
        name,
        dosage: body.dosage ? String(body.dosage).trim() : null,
        instructions: body.instructions ? String(body.instructions).trim() : null,
        time,
      }).returning('*');
      return res.status(201).json(created);
    } catch (err) {
      logger.error('Erro ao criar lembrete de medicamento', { message: err instanceof Error ? err.message : String(err) });
      return res.status(500).json({ error: 'Erro ao criar lembrete.' });
    }
  },

  async deleteMedicationReminder(req: AuthRequest, res: Response) {
    const id = req.params['id'] as string;
    const updated = await db('medication_reminders')
      .where({ id, user_id: req.userId! })
      .whereNull('deleted_at')
      .update({ deleted_at: db.fn.now(), updated_at: db.fn.now() });
    if (!updated) return res.status(404).json({ error: 'Lembrete não encontrado.' });
    return res.status(204).send();
  },

  async dependents(req: AuthRequest, res: Response) {
    const rows = await db('human_dependents')
      .where({ user_id: req.userId! })
      .whereNull('deleted_at')
      .select('*')
      .orderBy('created_at');
    return res.json(rows);
  },

  async createDependent(req: AuthRequest, res: Response) {
    try {
      const { name, cpf, birth_date, biological_sex, relationship, phone, legal_guardian_confirmed } =
        req.body as Record<string, unknown>;
      if (!name || !birth_date || !biological_sex || !relationship) {
        return res.status(400).json({ error: 'Nome, nascimento, sexo biológico e vínculo são obrigatórios.' });
      }
      if (legal_guardian_confirmed !== true) {
        return res.status(400).json({
          error: 'Confirme a autorização ou responsabilidade legal sobre o dependente.',
        });
      }
      const parsedBirth = new Date(`${String(birth_date)}T12:00:00`);
      if (Number.isNaN(parsedBirth.getTime()) || parsedBirth > new Date()) {
        return res.status(400).json({ error: 'Data de nascimento inválida.' });
      }
      const normalizedCpf = cpf ? String(cpf).replace(/\D/g, '') : null;
      if (normalizedCpf && normalizedCpf.length !== 11) {
        return res.status(400).json({ error: 'CPF inválido.' });
      }
      if (normalizedCpf) {
        const [userCpf, dependentCpf] = await Promise.all([
          db('users').whereRaw("regexp_replace(cpf, '[^0-9]', '', 'g') = ?", [normalizedCpf]).first(),
          db('human_dependents').where({ cpf: normalizedCpf }).whereNull('deleted_at').first(),
        ]);
        if (userCpf || dependentCpf) return res.status(400).json({ error: 'CPF já cadastrado.' });
      }
      const dependent = await db.transaction(async trx => {
        const [created] = await trx('human_dependents').insert({
          user_id: req.userId!,
          name: String(name).trim(),
          cpf: normalizedCpf,
          birth_date,
          biological_sex,
          relationship,
          phone: phone ? String(phone).trim() : null,
          legal_guardian_confirmed: legal_guardian_confirmed === true,
        }).returning('*');
        await trx('clinical_records').insert({
          user_id: req.userId!,
          dependent_id: created.id,
          pet_id: null,
          kind: 'humano',
        });
        return created;
      });
      return res.status(201).json(dependent);
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao cadastrar dependente.' });
    }
  },

  async updateDependent(req: AuthRequest, res: Response) {
    const id = req.params['id'] as string;
    const current = await db('human_dependents')
      .where({ id, user_id: req.userId! })
      .whereNull('deleted_at')
      .first();
    if (!current) return res.status(404).json({ error: 'Dependente não encontrado.' });
    const body = req.body as Record<string, unknown>;
    const patch: Record<string, unknown> = { updated_at: db.fn.now() };
    for (const key of ['name', 'birth_date', 'biological_sex', 'relationship', 'phone', 'legal_guardian_confirmed']) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    const [updated] = await db('human_dependents').where({ id }).update(patch).returning('*');
    return res.json(updated);
  },

  async deleteDependent(req: AuthRequest, res: Response) {
    const id = req.params['id'] as string;
    const updated = await db('human_dependents')
      .where({ id, user_id: req.userId! })
      .whereNull('deleted_at')
      .update({ deleted_at: db.fn.now(), updated_at: db.fn.now() });
    if (!updated) return res.status(404).json({ error: 'Dependente não encontrado.' });
    return res.status(204).send();
  },

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
        .leftJoin('human_dependents as d', 'cr.dependent_id', 'd.id')
        .where('cr.user_id', req.userId!)
        .select(
          'cr.id', 'cr.kind', 'cr.pet_id', 'cr.dependent_id', 'cr.blood_type', 'cr.allergies',
          'cr.comorbidities', 'cr.continuous_medications', 'cr.created_at',
          'p.name as pet_name', 'd.name as dependent_name',
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
        .leftJoin('human_dependents as d', 'pr.dependent_id', 'd.id')
        .where('pr.user_id', req.userId!)
        .select(
          'pr.id', 'pr.kind', 'pr.pet_id', 'pr.dependent_id', 'pr.content', 'pr.date',
          'professional.name as professional_name', 'p.name as pet_name', 'd.name as dependent_name',
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
