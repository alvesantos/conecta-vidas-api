import type { Request, Response } from 'express';
import { petService } from '../services/pet.service';
import type { AuthRequest } from '../middlewares/auth.middleware';
import logger from '../logger';

export const petController = {
  async create(req: AuthRequest, res: Response) {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({
          error: 'Requisição inválida. Envie os dados como multipart/form-data.',
        });
      }

      const {
        user_id,
        tutor_id,
        name,
        species,
        breed,
        size,
        coat,
        coat_color,
        birth_date,
        microchipped,
        neutered,
        weight,
        sex,
        behavior,
        conditions,
      } = req.body as Record<string, string | boolean>;

      const ownerId = req.userId ?? (user_id as string | undefined) ?? (tutor_id as string | undefined);
      if (!ownerId) {
        return res.status(400).json({ error: 'user_id obrigatório.' });
      }

      const avatar_url = req.file ? `/uploads/pets/${req.file.filename}` : undefined;

      const pet = await petService.create({
        user_id: ownerId,
        name: name as string,
        species: species as string,
        breed: breed as string,
        size: size as string,
        coat: coat as string,
        coat_color: (coat_color as string | undefined) || undefined,
        birth_date: birth_date as string,
        microchipped: microchipped === 'true' || microchipped === true,
        neutered: neutered === 'true' || neutered === true,
        weight: weight !== undefined && weight !== '' ? Number(weight) : undefined,
        sex: (sex as string | undefined) || undefined,
        behavior: (behavior as string | undefined) || undefined,
        conditions: (conditions as string | undefined) || undefined,
        avatar_url,
      });

      res.status(201).json(pet);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar pet.';
      logger.error('Erro ao criar pet', { message: err instanceof Error ? err.message : message, stack: err instanceof Error ? err.stack : undefined, body: req.body });
      const status = message.toLowerCase().includes('limite') ? 403 : 400;
      res.status(status).json({ error: message });
    }
  },

  async findMine(req: AuthRequest, res: Response) {
    try {
      if (!req.userId) return res.status(401).json({ error: 'Não autenticado.' });
      const pets = await petService.findByUser(req.userId);
      res.json(pets);
    } catch (err) {
      logger.error('Erro ao buscar pets do usuário', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, userId: req.userId });
      res.status(500).json({ error: 'Erro ao buscar pets.' });
    }
  },

  async findByUser(req: Request, res: Response) {
    try {
      const userId = (req.params['userId'] ?? req.params['tutorId']) as string;
      const pets = await petService.findByUser(userId);
      res.json(pets);
    } catch (err) {
      logger.error('Erro ao buscar pets por usuário', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, params: req.params });
      res.status(500).json({ error: 'Erro ao buscar pets.' });
    }
  },

  async findById(req: Request, res: Response) {
    try {
      const pet = await petService.findById(req.params['id'] as string);
      if (!pet) return res.status(404).json({ error: 'Pet não encontrado.' });
      res.json(pet);
    } catch (err) {
      logger.error('Erro ao buscar pet por id', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, id: req.params['id'] });
      res.status(500).json({ error: 'Erro ao buscar pet.' });
    }
  },

  async update(req: AuthRequest, res: Response) {
    try {
      const id = req.params['id'] as string;
      const existing = await petService.findById(id);
      if (!existing) return res.status(404).json({ error: 'Pet não encontrado.' });

      const isOwner = existing.user_id === req.userId;
      const isAdmin = req.userType === 'admin';
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Sem permissão para editar este pet.' });
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      for (const key of [
        'name', 'species', 'breed', 'size', 'coat', 'coat_color', 'birth_date',
        'sex', 'behavior', 'conditions',
      ] as const) {
        if (body[key] !== undefined) patch[key] = body[key];
      }
      if (body.weight !== undefined) {
        patch.weight = body.weight === '' || body.weight === null ? null : Number(body.weight);
      }
      if (body.microchipped !== undefined) {
        patch.microchipped = body.microchipped === true || body.microchipped === 'true';
      }
      if (body.neutered !== undefined) {
        patch.neutered = body.neutered === true || body.neutered === 'true';
      }
      if (req.file) {
        patch.avatar_url = `/uploads/pets/${req.file.filename}`;
      }

      const updated = await petService.update(id, patch);
      res.json(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar pet.';
      logger.error('Erro ao atualizar pet', { message: err instanceof Error ? err.message : message, stack: err instanceof Error ? err.stack : undefined, id: req.params['id'], body: req.body });
      res.status(400).json({ error: message });
    }
  },

  async remove(req: AuthRequest, res: Response) {
    try {
      const id = req.params['id'] as string;
      const existing = await petService.findById(id);
      if (!existing) return res.status(404).json({ error: 'Pet não encontrado.' });

      if (existing.user_id !== req.userId && req.userType !== 'admin') {
        return res.status(403).json({ error: 'Sem permissão para excluir este pet.' });
      }

      await petService.remove(id);
      return res.status(204).send();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir pet.';
      logger.error('Erro ao excluir pet', { message, petId: req.params['id'], userId: req.userId });
      return res.status(400).json({ error: message });
    }
  },
};
