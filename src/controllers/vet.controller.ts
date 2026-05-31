import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { userService } from '../services/user.service';
import { vetService } from '../services/vet.service';
import logger from '../logger';

export const vetController = {
  async createVet(req: AuthRequest, res: Response) {
    try {
      const {
        name, cnpj, email, password,
        pix_type, pix_key,
        bank_code, bank_name, bank_agency, bank_account_number,
        bank_account_digit, bank_account_type, bank_holder_type,
        billing_cep, billing_street, billing_number, billing_complement,
        billing_neighborhood, billing_city, billing_state,
      } = req.body as Record<string, string>;

      if (!name || !cnpj || !email || !password) {
        return res.status(400).json({ error: 'Nome, CNPJ, e-mail e senha são obrigatórios.' });
      }

      let recipientId: string | null = null;
      try {
        recipientId = await vetService.createRecipient({
          name, email, cnpj,
          pix_type, pix_key,
          bank_code, bank_name, bank_agency, bank_account_number,
          bank_account_digit, bank_account_type, bank_holder_type,
          billing_street, billing_number, billing_complement,
          billing_neighborhood, billing_city, billing_state, billing_cep,
        });
      } catch {
        // Recipient será criado quando a conta Pagar.me tiver marketplace habilitado
      }

      const user = await userService.create({
        name, email, password,
        cnpj,
        type: 'veterinario',
        recipient_id: recipientId,
        pix_type, pix_key,
        bank_code, bank_name, bank_agency, bank_account_number,
        bank_account_digit, bank_account_type, bank_holder_type,
        billing_cep, billing_street, billing_number, billing_complement,
        billing_neighborhood, billing_city, billing_state,
      });

      return res.status(201).json(user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar veterinário.';
      logger.error('Erro ao criar veterinário', { message: err instanceof Error ? err.message : msg, stack: err instanceof Error ? err.stack : undefined, email: req.body?.email });
      return res.status(400).json({ error: msg });
    }
  },

  async listVets(_req: AuthRequest, res: Response) {
    try {
      const vets = await vetService.findAllVets();
      res.json(vets);
    } catch (err) {
      logger.error('Erro ao listar veterinários', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined });
      res.status(500).json({ error: 'Erro ao listar veterinários.' });
    }
  },

  async getProfile(req: AuthRequest, res: Response) {
    try {
      const profile = await vetService.getVetProfile(req.userId!);
      if (!profile) return res.status(404).json({ error: 'Perfil não encontrado.' });
      res.json(profile);
    } catch (err) {
      logger.error('Erro ao buscar perfil do veterinário', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, userId: req.userId });
      res.status(500).json({ error: 'Erro ao buscar perfil.' });
    }
  },

  async changePassword(req: AuthRequest, res: Response) {
    try {
      const { current_password, new_password } = req.body as Record<string, string>;
      if (!current_password || !new_password) {
        return res.status(400).json({ error: 'Senha atual e nova senha são obrigatórias.' });
      }
      if (new_password.length < 6) {
        return res.status(400).json({ error: 'A nova senha deve ter pelo menos 6 caracteres.' });
      }
      await vetService.changePassword(req.userId!, current_password, new_password);
      res.json({ message: 'Senha alterada com sucesso.' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao alterar senha.';
      logger.error('Erro ao alterar senha do veterinário', { message: err instanceof Error ? err.message : msg, stack: err instanceof Error ? err.stack : undefined, userId: req.userId });
      res.status(400).json({ error: msg });
    }
  },

  async listConsultations(req: AuthRequest, res: Response) {
    try {
      const dateFilter = req.query['date'] as string | undefined;
      const consultations = await vetService.findConsultationsByVet(req.userId!, dateFilter);
      res.json(consultations);
    } catch (err) {
      logger.error('Erro ao listar consultas do veterinário', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, userId: req.userId });
      res.status(500).json({ error: 'Erro ao listar consultas.' });
    }
  },

  async updateConsultationStatus(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { status } = req.body as { status: string };
      const valid = ['agendada', 'confirmada', 'realizada', 'cancelada'];
      if (!valid.includes(status)) {
        return res.status(400).json({ error: `Status inválido. Use: ${valid.join(', ')}` });
      }
      const consultation = await vetService.updateConsultationStatus(id, req.userId!, status);
      res.json(consultation);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar consulta.';
      logger.error('Erro ao atualizar status da consulta', { message: err instanceof Error ? err.message : msg, stack: err instanceof Error ? err.stack : undefined, consultationId: req.params['id'], userId: req.userId });
      res.status(400).json({ error: msg });
    }
  },

  async getBalance(req: AuthRequest, res: Response) {
    try {
      const profile = await vetService.getVetProfile(req.userId!);
      if (!profile?.recipient_id) {
        return res.status(400).json({ error: 'Recebedor não configurado.' });
      }
      const balance = await vetService.getBalance(profile.recipient_id);
      res.json(balance);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao consultar saldo.';
      logger.error('Erro ao consultar saldo do veterinário', { message: err instanceof Error ? err.message : msg, stack: err instanceof Error ? err.stack : undefined, userId: req.userId });
      res.status(400).json({ error: msg });
    }
  },
};
