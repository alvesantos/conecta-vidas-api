import type { Request, Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { db } from '../database/knex';
import { userService } from '../services/user.service';
import { petService } from '../services/pet.service';
import { subscriptionService } from '../services/subscription.service';
import { consultationService } from '../services/consultation.service';
import { careQueueService, type QueueKind } from '../services/careQueue.service';
import logger from '../logger';

export const adminController = {
  async listUsers(_req: Request, res: Response) {
    try {
      const rows = await db('users as u')
        .leftJoin('subscriptions as s', function () {
          this.on('s.user_id', '=', 'u.id').andOn(db.raw("s.status = 'active'"));
        })
        .leftJoin('plans as p', 's.plan_id', 'p.id')
        .select(
          'u.id',
          'u.name',
          'u.email',
          'u.cpf',
          'u.address',
          'u.type',
          'u.status',
          'u.available_now',
          'u.available_since',
          'u.created_at',
          's.id as subscription_id',
          's.plan_id',
          's.paid_value',
          'p.title as plan_title',
          'p.price as plan_price',
          'p.color as plan_color'
        )
        .orderBy('u.created_at', 'desc');
      res.json(rows);
    } catch (err) {
      logger.error('Erro ao listar usuários', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined });
      res.status(500).json({ error: 'Erro ao listar usuários.' });
    }
  },

  async updateUserStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['active', 'suspended', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'Status inválido.' });
      }

      const update: Record<string, unknown> = { status };
      if (status !== 'active') {
        update['available_now'] = false;
        update['available_since'] = null;
      }
      const updated = await db('users').where({ id }).update(update);
      if (!updated) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      res.status(200).json({ message: 'Status atualizado com sucesso.' });
    } catch (err: any) {
      logger.error('Erro ao atualizar status', { message: err.message, stack: err.stack });
      res.status(500).json({ error: 'Erro interno ao atualizar status.' });
    }
  },

  async updateUser(req: Request, res: Response) {
    try {
      const id = req.params['id'] as string;
      const user = await userService.update(id, req.body ?? {});
      res.json(user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar usuário.';
      logger.error('Erro ao atualizar usuário', { message: err instanceof Error ? err.message : message, stack: err instanceof Error ? err.stack : undefined, id: req.params['id'] });
      res.status(400).json({ error: message });
    }
  },

  async deleteUser(req: Request, res: Response) {
    try {
      const id = req.params['id'] as string;
      await userService.remove(id);
      res.status(204).end();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir usuário.';
      logger.error('Erro ao excluir usuário', { message: err instanceof Error ? err.message : message, stack: err instanceof Error ? err.stack : undefined, id: req.params['id'] });
      res.status(400).json({ error: message });
    }
  },

  async assignUserPlan(req: Request, res: Response) {
    try {
      const userId = req.params['id'] as string;
      const { plan_id, paid_value } = (req.body ?? {}) as { plan_id?: string; paid_value?: number };
      if (!plan_id) return res.status(400).json({ error: 'plan_id obrigatório.' });
      const subscription = await subscriptionService.assign({
        user_id: userId,
        plan_id,
        paid_value: paid_value ?? 0,
      });
      res.status(201).json(subscription);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atribuir plano.';
      logger.error('Erro ao atribuir plano ao usuário', { message: err instanceof Error ? err.message : message, stack: err instanceof Error ? err.stack : undefined, userId: req.params['id'], body: req.body });
      res.status(400).json({ error: message });
    }
  },

  async cancelUserPlan(req: Request, res: Response) {
    try {
      const userId = req.params['id'] as string;
      await subscriptionService.cancel(userId);
      res.status(204).end();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao cancelar plano.';
      logger.error('Erro ao cancelar plano do usuário', { message: err instanceof Error ? err.message : message, stack: err instanceof Error ? err.stack : undefined, userId: req.params['id'] });
      res.status(400).json({ error: message });
    }
  },

  async listPets(_req: Request, res: Response) {
    try {
      const pets = await petService.findAllWithOwner();
      res.json(pets);
    } catch (err) {
      logger.error('Erro ao listar pets (admin)', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined });
      res.status(500).json({ error: 'Erro ao listar pets.' });
    }
  },

  async listBirthdayHumans(_req: Request, res: Response) {
    try {
      const humans = await userService.findBirthdayHumansThisMonth();
      return res.json(humans);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao buscar aniversariantes humanos.' });
    }
  },

  async listBirthdayPets(_req: Request, res: Response) {
    try {
      const pets = await petService.findBirthdayPetsThisMonth();
      res.json(pets);
    } catch (err) {
      logger.error('Erro ao listar pets de aniversário', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined });
      res.status(500).json({ error: 'Erro ao listar pets de aniversário.' });
    }
  },

  async getPet(req: Request, res: Response) {
    try {
      const pet = await petService.findByIdWithOwner(req.params['id'] as string);
      if (!pet) return res.status(404).json({ error: 'Pet não encontrado.' });
      res.json(pet);
    } catch (err) {
      logger.error('Erro ao buscar pet (admin)', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, id: req.params['id'] });
      res.status(500).json({ error: 'Erro ao buscar pet.' });
    }
  },

  async listConsultations(req: Request, res: Response) {
    try {
      const consultations = await consultationService.findAll();
      res.json(consultations);
    } catch (err) {
      logger.error('Erro ao listar consultas no painel admin', { message: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ error: 'Erro ao listar consultas.' });
    }
  },

  async assignVet(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { vet_id } = req.body as Record<string, string>;
      if (!vet_id) return res.status(400).json({ error: 'vet_id é obrigatório' });
      const consultation = await db('consultations').where({ id }).select('care_mode').first();
      if (consultation?.care_mode === 'pronto') {
        return res.status(400).json({ error: 'Use PATCH /admin/queue/:id/assign para direcionar atendimentos de pronto atendimento.' });
      }
      await consultationService.assignVet(id, vet_id);
      res.json({ success: true });
    } catch (err) {
      logger.error('Erro ao designar veterinário', { message: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ error: 'Erro ao designar veterinário.' });
    }
  },

  async cancelConsultation(req: Request, res: Response) {
    const id = req.params['id'] as string;
    const changed = await db.transaction(async trx => {
      const updated = await trx('consultations').where({ id }).whereNot('status', 'realizada')
        .update({ status: 'cancelada', updated_at: trx.fn.now() });
      if (updated) await careQueueService.syncOnConsultationStatus(trx, id, 'cancelada');
      return updated;
    });
    if (!changed) return res.status(404).json({ error: 'Consulta não encontrada ou já realizada.' });
    return res.json({ success: true });
  },

  async listQueue(req: Request, res: Response) {
    try {
      const kindParam = req.query['kind'];
      const kind = kindParam === 'humano' || kindParam === 'veterinario' ? kindParam : undefined;
      const [queue, humanProfessionals, vetProfessionals] = await Promise.all([
        careQueueService.listForAdmin(kind as QueueKind | undefined),
        careQueueService.listAvailableProfessionals('humano'),
        careQueueService.listAvailableProfessionals('veterinario'),
      ]);
      res.json({ queue, professionals: { humano: humanProfessionals, veterinario: vetProfessionals } });
    } catch (err) {
      logger.error('Erro ao listar fila (admin)', { message: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ error: 'Erro ao listar fila.' });
    }
  },

  async assignQueueItem(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { professional_id } = req.body as { professional_id?: string };
      if (!professional_id) return res.status(400).json({ error: 'professional_id é obrigatório.' });
      const result = await careQueueService.assignToProfessional(id, professional_id, (req as AuthRequest).userId!);
      if ('conflict' in result) return res.status(409).json({ error: 'Este paciente não está mais aguardando na fila.' });
      if ('invalid' in result) return res.status(400).json({ error: 'Profissional incompatível ou inativo para este tipo de atendimento.' });
      if ('unavailable' in result) return res.status(409).json({ error: 'Este profissional não está marcado como disponível agora.' });
      res.json(result);
    } catch (err) {
      logger.error('Erro ao direcionar paciente da fila', { message: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ error: 'Erro ao direcionar paciente.' });
    }
  },

  async getDashboardStats(_req: Request, res: Response) {
    try {
      res.json({ users: 0, subscriptions: 0 });
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar stats' });
    }
  },

  async listSubscriptions(_req: Request, res: Response) {
    try {
      const subs = await subscriptionService.findAll();
      res.json(subs);
    } catch (err) {
      res.status(500).json({ error: 'Erro ao buscar assinaturas' });
    }
  }
};
