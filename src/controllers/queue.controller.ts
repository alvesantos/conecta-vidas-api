import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { db } from '../database/knex';
import logger from '../logger';

type QueueKind = 'humano' | 'veterinario';

async function patientQueueState(userId: string, consultationId: string) {
  const item = await db('care_queue as q')
    .join('consultations as c', 'q.consultation_id', 'c.id')
    .leftJoin('users as professional', 'c.vet_id', 'professional.id')
    .leftJoin('pets as pet', 'q.pet_id', 'pet.id')
    .leftJoin('human_dependents as dependent', 'q.dependent_id', 'dependent.id')
    .where({ 'q.consultation_id': consultationId, 'q.user_id': userId })
    .select(
      'q.id', 'q.consultation_id', 'q.kind', 'q.status', 'q.priority', 'q.joined_at', 'q.called_at',
      'q.pet_id', 'q.dependent_id', 'c.meet_link', 'professional.name as professional_name',
      'pet.name as pet_name', 'dependent.name as dependent_name',
    )
    .first();
  if (!item) return null;

  let position: number | null = null;
  if (item.status === 'aguardando') {
    const row = await db('care_queue')
      .where({ kind: item.kind, status: 'aguardando' })
      .andWhere(builder => builder
        .where('priority', '>', item.priority ?? 0)
        .orWhere(inner => inner
          .where('priority', item.priority ?? 0)
          .andWhere('joined_at', '<=', item.joined_at)))
      .count<{ count: string }[]>('id as count')
      .first();
    position = Math.max(1, Number(row?.count ?? 1));
  }
  const estimate = position === null
    ? null
    : position === 1
      ? 'Atendimento próximo'
      : `Estimativa aproximada: ${Math.max(5, (position - 1) * 8)}–${position * 12} min`;
  return { ...item, position, estimate };
}

async function listProfessional(kind: QueueKind) {
  return db('care_queue as q')
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
}

async function callNext(req: AuthRequest, res: Response, kind: QueueKind) {
  try {
    const id = req.params['id'] as string;
    const result = await db.transaction(async trx => {
      const item = await trx('care_queue').where({ id, kind, status: 'aguardando' }).forUpdate().first();
      if (!item) return null;
      const [queue] = await trx('care_queue').where({ id }).update({
        status: 'chamado', called_at: trx.fn.now(), updated_at: trx.fn.now(),
      }).returning('*');
      const [consultation] = await trx('consultations').where({ id: item.consultation_id }).update({
        vet_id: req.userId!, status: 'confirmada', updated_at: trx.fn.now(),
      }).returning('*');
      return { queue, consultation };
    });
    if (!result) return res.status(409).json({ error: 'Este paciente não está mais aguardando.' });
    return res.json(result);
  } catch (err) {
    logger.error('Erro ao chamar paciente da fila', { message: err instanceof Error ? err.message : String(err), userId: req.userId });
    return res.status(500).json({ error: 'Erro ao chamar paciente.' });
  }
}

export const queueController = {
  async status(req: AuthRequest, res: Response) {
    const state = await patientQueueState(req.userId!, req.params['consultationId'] as string);
    if (!state) return res.status(404).json({ error: 'Fila não encontrada.' });
    return res.json(state);
  },

  async events(req: AuthRequest, res: Response) {
    const consultationId = req.params['consultationId'] as string;
    const initial = await patientQueueState(req.userId!, consultationId);
    if (!initial) return res.status(404).json({ error: 'Fila não encontrada.' });
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    let lastPayload = '';
    const send = async () => {
      try {
        const state = await patientQueueState(req.userId!, consultationId);
        const payload = JSON.stringify(state);
        if (payload !== lastPayload) {
          res.write(`event: queue\ndata: ${payload}\n\n`);
          lastPayload = payload;
        } else {
          res.write(': heartbeat\n\n');
        }
      } catch {
        res.write('event: error\ndata: {"error":"Falha ao atualizar fila"}\n\n');
      }
    };
    await send();
    const interval = setInterval(send, 5000);
    req.on('close', () => clearInterval(interval));
  },

  async leave(req: AuthRequest, res: Response) {
    const consultationId = req.params['consultationId'] as string;
    const result = await db.transaction(async trx => {
      const item = await trx('care_queue')
        .where({ consultation_id: consultationId, user_id: req.userId!, status: 'aguardando' })
        .forUpdate()
        .first();
      if (!item) return false;
      await trx('care_queue').where({ id: item.id }).update({ status: 'saiu', left_at: trx.fn.now(), updated_at: trx.fn.now() });
      await trx('consultations').where({ id: consultationId }).update({ status: 'cancelada', updated_at: trx.fn.now() });
      return true;
    });
    if (!result) return res.status(409).json({ error: 'Não é mais possível sair desta fila.' });
    return res.status(204).send();
  },

  async humanList(_req: AuthRequest, res: Response) {
    return res.json(await listProfessional('humano'));
  },
  async veterinaryList(_req: AuthRequest, res: Response) {
    return res.json(await listProfessional('veterinario'));
  },
  async callHuman(req: AuthRequest, res: Response) {
    return callNext(req, res, 'humano');
  },
  async callVeterinary(req: AuthRequest, res: Response) {
    return callNext(req, res, 'veterinario');
  },
};
