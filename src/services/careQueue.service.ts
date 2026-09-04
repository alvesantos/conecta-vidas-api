import type { Knex } from 'knex';
import { db } from '../database/knex';

export type QueueKind = 'humano' | 'veterinario';

interface TriageContext {
  id: string;
  consultation_id: string;
  description: string | null;
  recommendation: string | null;
  symptoms: { label: string; severity: string }[];
}

async function attachTriageContext<T extends { consultation_id: string }>(rows: T[]): Promise<(T & { triage: TriageContext | null })[]> {
  if (!rows.length) return rows.map(row => ({ ...row, triage: null }));

  const consultationIds = rows.map(row => row.consultation_id);
  const triages = await db('quick_triages')
    .whereIn('consultation_id', consultationIds)
    .select('id', 'consultation_id', 'description', 'recommendation');

  const triageIds = triages.map(t => t.id);
  const symptoms = triageIds.length
    ? await db('quick_triage_symptoms as qts')
        .join('symptom_catalog as sc', 'qts.symptom_id', 'sc.id')
        .whereIn('qts.triage_id', triageIds)
        .select('qts.triage_id', 'sc.label', 'sc.severity')
    : [];

  const byConsultation = new Map(
    triages.map(t => [t.consultation_id, {
      ...t,
      symptoms: symptoms.filter(s => s.triage_id === t.id).map(s => ({ label: s.label, severity: s.severity })),
    }]),
  );

  return rows.map(row => ({ ...row, triage: byConsultation.get(row.consultation_id) ?? null }));
}

export const careQueueService = {
  /** Sincroniza care_queue quando a consulta muda de status. Chamado dentro de uma trx já aberta pelo caller. */
  async syncOnConsultationStatus(trx: Knex.Transaction, consultationId: string, status: string) {
    if (!['realizada', 'cancelada'].includes(status)) return;
    const nextQueueStatus = status === 'realizada' ? 'concluido' : 'saiu';
    await trx('care_queue')
      .where({ consultation_id: consultationId })
      .whereIn('status', ['aguardando', 'chamado', 'em_atendimento'])
      .update({
        status: nextQueueStatus,
        left_at: status === 'cancelada' ? trx.fn.now() : null,
        updated_at: trx.fn.now(),
      });
  },

  /** chamado→em_atendimento quando o profissional efetivamente entra na sala. Idempotente. */
  async markInProgress(consultationId: string) {
    return db('care_queue')
      .where({ consultation_id: consultationId, status: 'chamado' })
      .update({ status: 'em_atendimento', updated_at: db.fn.now() });
  },

  async setAvailability(userId: string, available: boolean) {
    return db('users').where({ id: userId }).update({
      available_now: available,
      available_since: available ? db.fn.now() : null,
      updated_at: db.fn.now(),
    }).returning(['id', 'available_now', 'available_since']);
  },

  async listForProfessional(kind: QueueKind) {
    const rows = await db('care_queue as q')
      .join('consultations as c', 'q.consultation_id', 'c.id')
      .join('users as patient', 'q.user_id', 'patient.id')
      .leftJoin('pets as pet', 'q.pet_id', 'pet.id')
      .leftJoin('human_dependents as dependent', 'q.dependent_id', 'dependent.id')
      .where({ 'q.kind': kind, 'q.status': 'aguardando' })
      .select(
        'q.id', 'q.consultation_id', 'q.joined_at', 'q.priority',
        'patient.name as owner_name', 'pet.name as pet_name', 'dependent.name as dependent_name',
        'c.notes',
      )
      .orderBy('q.priority', 'desc')
      .orderBy('q.joined_at', 'asc');
    return attachTriageContext(rows);
  },

  async listForAdmin(kindFilter?: QueueKind) {
    const rows = await db('care_queue as q')
      .join('consultations as c', 'q.consultation_id', 'c.id')
      .join('users as patient', 'q.user_id', 'patient.id')
      .leftJoin('users as professional', 'c.vet_id', 'professional.id')
      .leftJoin('pets as pet', 'q.pet_id', 'pet.id')
      .leftJoin('human_dependents as dependent', 'q.dependent_id', 'dependent.id')
      .modify(qb => { if (kindFilter) qb.where('q.kind', kindFilter); })
      .whereIn('q.status', ['aguardando', 'chamado', 'em_atendimento'])
      .select(
        'q.id', 'q.consultation_id', 'q.kind', 'q.status', 'q.priority', 'q.joined_at', 'q.called_at',
        'q.assigned_by_admin_id',
        'patient.name as owner_name', 'pet.name as pet_name', 'dependent.name as dependent_name',
        'professional.name as professional_name', 'professional.id as professional_id',
      )
      .orderByRaw(`CASE q.status WHEN 'aguardando' THEN 0 WHEN 'chamado' THEN 1 ELSE 2 END`)
      .orderBy('q.priority', 'desc')
      .orderBy('q.joined_at', 'asc');
    return attachTriageContext(rows);
  },

  async listAvailableProfessionals(kind: QueueKind) {
    const userType = kind === 'humano' ? 'medico' : 'veterinario';
    return db('users')
      .where({ type: userType, status: 'active' })
      .select('id', 'name', 'available_now', 'available_since')
      .orderBy('available_now', 'desc')
      .orderBy('name', 'asc');
  },

  async assignToProfessional(queueItemId: string, professionalId: string, adminUserId: string) {
    return db.transaction(async trx => {
      const item = await trx('care_queue').where({ id: queueItemId, status: 'aguardando' }).forUpdate().first();
      if (!item) return { conflict: true as const };

      const professional = await trx('users').where({ id: professionalId }).first();
      const expectedType = item.kind === 'humano' ? 'medico' : 'veterinario';
      if (!professional || professional.type !== expectedType || professional.status !== 'active') {
        return { invalid: true as const };
      }
      if (!professional.available_now) return { unavailable: true as const };

      const [queue] = await trx('care_queue').where({ id: queueItemId }).update({
        status: 'chamado', called_at: trx.fn.now(), assigned_by_admin_id: adminUserId, updated_at: trx.fn.now(),
      }).returning('*');
      const [consultation] = await trx('consultations').where({ id: item.consultation_id }).update({
        vet_id: professionalId, status: 'confirmada', updated_at: trx.fn.now(),
      }).returning('*');
      return { queue, consultation };
    });
  },
};
