import type { Request, Response } from 'express';
import { db } from '../database/knex';
import { userService } from '../services/user.service';
import { petService } from '../services/pet.service';
import { subscriptionService } from '../services/subscription.service';
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
};
