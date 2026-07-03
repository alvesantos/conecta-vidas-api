import type { Request, Response } from 'express';
import { userService } from '../services/user.service';
import { vetService } from '../services/vet.service';
import type { AuthRequest } from '../middlewares/auth.middleware';
import logger from '../logger';

export const userController = {
  async create(req: Request, res: Response) {
    try {
      const user = await userService.create({ ...req.body, type: 'tutor' });
      res.status(201).json(user);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar usuário.';
      logger.error('Erro ao criar usuário', { message: err instanceof Error ? err.message : message, stack: err instanceof Error ? err.stack : undefined, body: req.body });
      res.status(400).json({ error: message });
    }
  },

  async findAll(_req: Request, res: Response) {
    try {
      const users = await userService.findAll();
      res.json(users);
    } catch (err) {
      logger.error('Erro ao buscar usuários', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined });
      res.status(500).json({ error: 'Erro ao buscar usuários.' });
    }
  },

  async findById(req: Request, res: Response) {
    try {
      const user = await userService.findById(req.params['id'] as string);
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
      res.json(user);
    } catch (err) {
      logger.error('Erro ao buscar usuário por id', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, id: req.params['id'] });
      res.status(500).json({ error: 'Erro ao buscar usuário.' });
    }
  },

  async me(req: AuthRequest, res: Response) {
    try {
      if (!req.userId) return res.status(401).json({ error: 'Não autenticado.' });
      const user = await userService.findById(req.userId);
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
      res.json(user);
    } catch (err) {
      logger.error('Erro ao buscar usuário autenticado', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, userId: req.userId });
      res.status(500).json({ error: 'Erro ao buscar usuário.' });
    }
  },

  async listVets(_req: Request, res: Response) {
    try {
      const vets = await vetService.findAllVets();
      const safeVets = vets.map(v => ({ id: v.id, name: v.name, email: v.email, crmv: v.crmv })); // return safe fields
      res.json(safeVets);
    } catch (err) {
      logger.error('Erro ao buscar veterinários', { message: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ error: 'Erro ao buscar veterinários.' });
    }
  },

  /**
   * [Bot] Verifica se um CPF já é cadastrado. Retorna { registered, user? }
   * com dados mínimos, sem vazar campos sensíveis.
   */
  async lookupByCpf(req: Request, res: Response) {
    try {
      const cpf = String(req.params['cpf'] ?? '');
      if (cpf.replace(/\D/g, '').length !== 11) {
        return res.status(400).json({ error: 'CPF inválido.' });
      }
      const user = await userService.findByCpf(cpf);
      if (!user) return res.json({ registered: false });
      res.json({
        registered: true,
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone ?? null },
      });
    } catch (err) {
      logger.error('Erro no lookup de CPF (bot)', { message: err instanceof Error ? err.message : String(err) });
      res.status(500).json({ error: 'Erro ao consultar CPF.' });
    }
  },

  /**
   * [Bot] Cadastra um responsável a partir do WhatsApp (nome, CPF, telefone).
   */
  async registerFromWhatsApp(req: Request, res: Response) {
    try {
      const { name, cpf, phone, email } = req.body as Record<string, string>;
      if (!name || !cpf || !phone) {
        return res.status(400).json({ error: 'Nome, CPF e telefone são obrigatórios.' });
      }
      const user = await userService.createFromWhatsApp({ name, cpf, phone, email });
      res.status(201).json({ registered: true, user });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao cadastrar via WhatsApp.';
      logger.error('Erro ao cadastrar via WhatsApp (bot)', { message });
      res.status(400).json({ error: message });
    }
  },
};
