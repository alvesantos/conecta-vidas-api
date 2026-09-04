import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { medicoService } from '../services/medico.service';
import logger from '../logger';
import { logClinicalAccess } from '../services/clinicalAudit.service';

export const medicoController = {
  async getDashboardStats(req: AuthRequest, res: Response) {
    try {
      const data = await medicoService.getDashboardStats(req.userId!);
      return res.json(data);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar dashboard.' });
    }
  },

  async getProfile(req: AuthRequest, res: Response) {
    try {
      const profile = await medicoService.getProfile(req.userId!);
      if (!profile) return res.status(404).json({ error: 'Perfil não encontrado.' });
      return res.json(profile);
    } catch (err) {
      logger.error('Erro ao buscar perfil médico', {
        message: err instanceof Error ? err.message : String(err),
        userId: req.userId,
      });
      return res.status(500).json({ error: 'Erro ao buscar perfil.' });
    }
  },

  async updateFinanceiro(req: AuthRequest, res: Response) {
    try {
      const {
        pix_type, pix_key,
        bank_code, bank_name, bank_agency, bank_account_number,
        bank_account_digit, bank_account_type,
      } = req.body as Record<string, string>;

      const validPixTypes = ['cpf', 'cnpj', 'email', 'telefone', 'aleatoria'];
      if (pix_type && !validPixTypes.includes(pix_type)) {
        return res.status(400).json({ error: 'Tipo de chave Pix inválido.' });
      }
      const validAccountTypes = ['corrente', 'poupanca'];
      if (bank_account_type && !validAccountTypes.includes(bank_account_type)) {
        return res.status(400).json({ error: 'Tipo de conta bancária inválido.' });
      }

      const profile = await medicoService.updateFinanceiro(req.userId!, {
        pix_type, pix_key,
        bank_code, bank_name, bank_agency, bank_account_number,
        bank_account_digit, bank_account_type,
      });
      return res.json(profile);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao atualizar dados financeiros.';
      logger.error('Erro ao atualizar dados financeiros do médico', { message, userId: req.userId });
      return res.status(400).json({ error: message });
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
      await medicoService.changePassword(req.userId!, current_password, new_password);
      return res.json({ message: 'Senha alterada com sucesso.' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao alterar senha.';
      logger.error('Erro ao alterar senha do médico', { message, userId: req.userId });
      return res.status(400).json({ error: message });
    }
  },

  async listConsultations(req: AuthRequest, res: Response) {
    try {
      const consultations = await medicoService.findConsultations(
        req.userId!,
        req.query['date'] as string | undefined,
      );
      return res.json(consultations);
    } catch (err) {
      logger.error('Erro ao listar consultas médicas', {
        message: err instanceof Error ? err.message : String(err),
        userId: req.userId,
      });
      return res.status(500).json({ error: 'Erro ao listar consultas.' });
    }
  },

  async listRecords(req: AuthRequest, res: Response) {
    try {
      const records = await medicoService.findHumanRecords(req.userId!);
      await logClinicalAccess({
        actorUserId: req.userId!, action: 'list', resourceType: 'clinical_record', context: 'humano',
      });
      return res.json(records);
    } catch (err) {
      logger.error('Erro ao listar prontuários humanos', { message: err instanceof Error ? err.message : String(err), userId: req.userId });
      return res.status(500).json({ error: 'Erro ao listar prontuários.' });
    }
  },

  async getRecord(req: AuthRequest, res: Response) {
    try {
      const recordId = req.params['patientId'] as string;
      const record = await medicoService.findHumanRecord(req.userId!, recordId);
      if (!record) return res.status(404).json({ error: 'Prontuário não encontrado.' });
      await logClinicalAccess({
        actorUserId: req.userId!, patientUserId: record.user_id, action: 'read',
        resourceType: 'clinical_record', resourceId: record.id, context: 'humano',
      });
      return res.json(record);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar prontuário.' });
    }
  },

  async listPrescriptions(req: AuthRequest, res: Response) {
    try {
      const rows = await medicoService.findHumanPrescriptions(req.userId!);
      await logClinicalAccess({
        actorUserId: req.userId!, action: 'list', resourceType: 'prescription', context: 'humano',
      });
      return res.json(rows);
    } catch {
      return res.status(500).json({ error: 'Erro ao listar receitas.' });
    }
  },

  async createPrescription(req: AuthRequest, res: Response) {
    try {
      const { patient_id, dependent_id, content, date } = req.body as Record<string, string>;
      if (!patient_id || !content?.trim() || !date) {
        return res.status(400).json({ error: 'Paciente, conteúdo e data são obrigatórios.' });
      }
      const prescription = await medicoService.createHumanPrescription(req.userId!, patient_id, dependent_id || null, content, date);
      await logClinicalAccess({
        actorUserId: req.userId!, patientUserId: patient_id, action: 'create',
        resourceType: 'prescription', resourceId: prescription.id, context: 'humano',
      });
      return res.status(201).json(prescription);
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao emitir receita.' });
    }
  },
};
