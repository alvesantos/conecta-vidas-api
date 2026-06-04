import type { Request, Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { userService } from '../services/user.service';
import { vetService } from '../services/vet.service';
import { prescriptionService } from '../services/prescription.service';
import { medicalRecordService } from '../services/medical_record.service';
import logger from '../logger';

export const vetController = {
  async createVet(req: AuthRequest, res: Response) {
    try {
      const {
        name, cnpj, email, password, crmv,
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
        cnpj, crmv: crmv || null,
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

  async updateVet(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { name, email, crmv } = (req.body ?? {}) as Record<string, string>;
      const user = await userService.update(id, { name, email, crmv: crmv || null });
      res.json(user);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao atualizar veterinário.';
      logger.error('Erro ao atualizar veterinário', { message: err instanceof Error ? err.message : msg, stack: err instanceof Error ? err.stack : undefined, id: (req.params as { id: string }).id });
      res.status(400).json({ error: msg });
    }
  },

  async deleteVet(req: Request, res: Response) {
    try {
      const { id } = req.params as { id: string };
      await userService.remove(id);
      res.status(204).end();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir veterinário.';
      logger.error('Erro ao excluir veterinário', { message: err instanceof Error ? err.message : msg, stack: err instanceof Error ? err.stack : undefined, id: (req.params as { id: string }).id });
      res.status(400).json({ error: msg });
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

  async listResponsibles(_req: AuthRequest, res: Response) {
    try {
      const responsibles = await prescriptionService.findResponsibles();
      res.json(responsibles);
    } catch (err) {
      logger.error('Erro ao listar responsáveis', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined });
      res.status(500).json({ error: 'Erro ao listar responsáveis.' });
    }
  },

  async listResponsiblePets(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const pets = await prescriptionService.findPetsByResponsible(id);
      res.json(pets);
    } catch (err) {
      logger.error('Erro ao listar animais do responsável', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, responsibleId: req.params['id'] });
      res.status(500).json({ error: 'Erro ao listar animais.' });
    }
  },

  async createPrescription(req: AuthRequest, res: Response) {
    try {
      const { user_id, pet_id, content, date } = req.body as Record<string, string>;
      if (!user_id || !content || !date) {
        return res.status(400).json({ error: 'Responsável, conteúdo e data são obrigatórios.' });
      }
      const prescription = await prescriptionService.create({
        vet_id: req.userId!,
        user_id,
        pet_id: pet_id || null,
        content,
        date,
      });
      res.status(201).json(prescription);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar prescrição.';
      logger.error('Erro ao criar prescrição', { message: err instanceof Error ? err.message : msg, stack: err instanceof Error ? err.stack : undefined, userId: req.userId });
      res.status(400).json({ error: msg });
    }
  },

  async listPrescriptions(req: AuthRequest, res: Response) {
    try {
      const prescriptions = await prescriptionService.findByVet(req.userId!);
      res.json(prescriptions);
    } catch (err) {
      logger.error('Erro ao listar prescrições', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, userId: req.userId });
      res.status(500).json({ error: 'Erro ao listar prescrições.' });
    }
  },

  async getPrescription(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const prescription = await prescriptionService.findById(id);
      if (!prescription || prescription.vet_id !== req.userId) {
        return res.status(404).json({ error: 'Prescrição não encontrada.' });
      }
      res.json(prescription);
    } catch (err) {
      logger.error('Erro ao buscar prescrição', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, prescriptionId: req.params['id'] });
      res.status(500).json({ error: 'Erro ao buscar prescrição.' });
    }
  },

  async listMedicalRecordTutors(req: AuthRequest, res: Response) {
    try {
      const records = await medicalRecordService.findTutorsByVet(req.userId!);
      res.json(records);
    } catch (err) {
      logger.error('Erro ao listar tutores de prontuários', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, userId: req.userId });
      res.status(500).json({ error: 'Erro ao listar tutores de prontuários.' });
    }
  },

  async listMedicalRecordsByTutor(req: AuthRequest, res: Response) {
    try {
      const { tutorId } = req.params as { tutorId: string };
      const records = await medicalRecordService.findByVetAndTutor(req.userId!, tutorId);
      res.json(records);
    } catch (err) {
      logger.error('Erro ao listar prontuários do tutor', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, userId: req.userId });
      res.status(500).json({ error: 'Erro ao listar prontuários.' });
    }
  },

  async getMedicalRecord(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const record = await medicalRecordService.findById(id);
      if (!record || record.vet_id !== req.userId) {
        return res.status(404).json({ error: 'Prontuário não encontrado.' });
      }
      res.json(record);
    } catch (err) {
      logger.error('Erro ao buscar prontuário', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, recordId: req.params['id'] });
      res.status(500).json({ error: 'Erro ao buscar prontuário.' });
    }
  },

  async updateMedicalRecord(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params as { id: string };
      const { content } = req.body as { content: string };
      const record = await medicalRecordService.findById(id);
      if (!record || record.vet_id !== req.userId) {
        return res.status(404).json({ error: 'Prontuário não encontrado.' });
      }
      const updated = await medicalRecordService.updateContent(id, content);
      res.json(updated);
    } catch (err) {
      logger.error('Erro ao atualizar prontuário', { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined, recordId: req.params['id'] });
      res.status(500).json({ error: 'Erro ao atualizar prontuário.' });
    }
  }
};
