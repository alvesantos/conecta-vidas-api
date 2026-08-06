import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { db } from '../database/knex';
import logger from '../logger';
import { planEntitlementService } from '../services/planEntitlement.service';
import { logClinicalAccess } from '../services/clinicalAudit.service';

type TriageKind = 'humano' | 'veterinario';

async function validateProfile(userId: string, kind: TriageKind, petId: string | null, dependentId: string | null) {
  if (kind === 'veterinario') {
    if (!petId) return false;
    return Boolean(await db('pets').where({ id: petId, user_id: userId }).whereNull('deleted_at').first());
  }
  if (!dependentId) return true;
  return Boolean(await db('human_dependents').where({ id: dependentId, user_id: userId }).whereNull('deleted_at').first());
}

function nowInFortaleza() {
  const now = new Date();
  return {
    date: now.toLocaleDateString('en-CA', { timeZone: 'America/Fortaleza' }),
    time: now.toLocaleTimeString('pt-BR', { timeZone: 'America/Fortaleza', hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}

export const triageController = {
  async catalog(req: AuthRequest, res: Response) {
    const kind: TriageKind = req.query['kind'] === 'veterinario' ? 'veterinario' : 'humano';
    const rows = await db('symptom_catalog')
      .where({ kind, active: true })
      .select('id', 'code', 'label', 'severity', 'guidance')
      .orderBy('sort_order');
    return res.json(rows);
  },

  async start(req: AuthRequest, res: Response) {
    try {
      const body = req.body as Record<string, unknown>;
      const kind: TriageKind = body.kind === 'veterinario' ? 'veterinario' : 'humano';
      const petId = kind === 'veterinario' && body.pet_id ? String(body.pet_id) : null;
      const dependentId = kind === 'humano' && body.dependent_id ? String(body.dependent_id) : null;
      if (!await validateProfile(req.userId!, kind, petId, dependentId)) {
        return res.status(400).json({ error: 'Perfil inválido para a triagem.' });
      }
      const [triage] = await db('quick_triages').insert({
        user_id: req.userId!, kind, pet_id: petId, dependent_id: dependentId,
      }).returning('*');
      return res.status(201).json(triage);
    } catch (err) {
      logger.error('Erro ao iniciar triagem', { message: err instanceof Error ? err.message : String(err), userId: req.userId });
      return res.status(500).json({ error: 'Erro ao iniciar triagem.' });
    }
  },

  async complete(req: AuthRequest, res: Response) {
    try {
      const id = req.params['id'] as string;
      const body = req.body as Record<string, unknown>;
      const symptomIds = Array.from(new Set(Array.isArray(body.symptom_ids) ? body.symptom_ids.map(String) : []));
      if (symptomIds.length < 2 || symptomIds.length > 3) {
        return res.status(400).json({ error: 'Selecione de dois a três sintomas principais.' });
      }
      const triage = await db('quick_triages').where({ id, user_id: req.userId!, status: 'iniciada' }).first();
      if (!triage) return res.status(404).json({ error: 'Triagem em andamento não encontrada.' });
      const symptoms = await db('symptom_catalog')
        .whereIn('id', symptomIds)
        .where({ kind: triage.kind, active: true })
        .select('id', 'label', 'severity', 'guidance');
      if (symptoms.length !== symptomIds.length) return res.status(400).json({ error: 'Há sintomas inválidos para este contexto.' });

      const emergency = symptoms.some(item => item.severity === 'emergency');
      const warning = symptoms.some(item => item.severity === 'warning');
      const recommendation = emergency ? 'emergencia_presencial' : warning ? 'prioridade' : 'teleatendimento';
      const description = body.description ? String(body.description).trim() : null;
      const quote = emergency ? null : await planEntitlementService.quoteForUser(
        req.userId!,
        triage.kind === 'humano' ? 'humana' : 'veterinaria',
        'pronto',
      );
      const now = nowInFortaleza();

      const result = await db.transaction(async trx => {
        await trx('quick_triage_symptoms').insert(symptoms.map(item => ({ triage_id: id, symptom_id: item.id })));
        let consultation = null;
        if (!emergency && quote) {
          [consultation] = await trx('consultations').insert({
            vet_id: null,
            tutor_id: req.userId!,
            pet_id: triage.pet_id,
            dependent_id: triage.dependent_id,
            date: now.date,
            time: now.time,
            notes: description || `Triagem: ${symptoms.map(item => item.label).join(', ')}`,
            status: 'agendada',
            is_free: quote.coveredByPlan,
            charged_value: quote.price,
            kind: triage.kind === 'humano' ? 'humana' : 'veterinaria',
            care_mode: 'pronto',
          }).returning('*');
        }
        const [completed] = await trx('quick_triages').where({ id }).update({
          status: 'concluida',
          description,
          recommendation,
          consultation_id: consultation?.id ?? null,
          completed_at: trx.fn.now(),
          updated_at: trx.fn.now(),
        }).returning('*');
        return { triage: completed, consultation };
      });
      await logClinicalAccess({
        actorUserId: req.userId!, patientUserId: req.userId!, action: 'create',
        resourceType: 'quick_triage', resourceId: id, context: triage.kind,
      });
      return res.json({
        ...result,
        symptoms,
        quote,
        emergency,
        guidance: symptoms.filter(item => item.guidance).map(item => item.guidance),
        disclaimer: 'Esta triagem é apenas orientativa e não constitui diagnóstico.',
      });
    } catch (err) {
      logger.error('Erro ao concluir triagem', { message: err instanceof Error ? err.message : String(err), userId: req.userId });
      return res.status(500).json({ error: 'Erro ao concluir triagem.' });
    }
  },
};
