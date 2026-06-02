import type { Request, Response } from 'express';
import { planService, type CreatePlanDTO, type UpdatePlanDTO } from '../services/plan.service';

export const planController = {
  async list(_req: Request, res: Response) {
    try {
      const plans = await planService.findAll();
      res.json(plans);
    } catch {
      res.status(500).json({ error: 'Erro ao buscar planos.' });
    }
  },

  async listAdmin(_req: Request, res: Response) {
    try {
      const plans = await planService.findAll({ includeInactive: true });
      res.json(plans);
    } catch {
      res.status(500).json({ error: 'Erro ao buscar planos.' });
    }
  },

  async findById(req: Request, res: Response) {
    try {
      const plan = await planService.findById(req.params['id'] as string);
      if (!plan) return res.status(404).json({ error: 'Plano não encontrado.' });
      res.json(plan);
    } catch {
      res.status(500).json({ error: 'Erro ao buscar plano.' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const body = req.body as CreatePlanDTO;
      if (!body?.title || body.price === undefined) {
        return res.status(400).json({ error: 'Título e preço são obrigatórios.' });
      }
      const plan = await planService.create({
        title: body.title,
        color: body.color ?? '#014496',
        focus: body.focus ?? '',
        focus_desc: body.focus_desc ?? '',
        price: Number(body.price),
        free_consultations:
          body.free_consultations !== undefined ? Number(body.free_consultations) : 0,
        perks: Array.isArray(body.perks) ? body.perks : [],
        is_active: body.is_active,
      });
      res.status(201).json(plan);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar plano.';
      res.status(400).json({ error: message });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      await planService.delete(req.params['id'] as string);
      res.status(204).end();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir plano.';
      res.status(400).json({ error: message });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const body = req.body as UpdatePlanDTO;
      const plan = await planService.update(req.params['id'] as string, {
        ...body,
        price: body.price !== undefined ? Number(body.price) : undefined,
        free_consultations:
          body.free_consultations !== undefined ? Number(body.free_consultations) : undefined,
      });
      res.json(plan);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar plano.';
      res.status(400).json({ error: message });
    }
  },
};
