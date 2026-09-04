import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware';
import { consultationService } from '../services/consultation.service';
import { planEntitlementService } from '../services/planEntitlement.service';
import logger from '../logger';
import { db } from '../database/knex';
import { contextFromPetId } from '../utils/clinicalContext';
import { schedulingService } from '../services/scheduling.service';
import { consultationEmailService } from '../services/consultationEmail.service';

export const consultationController = {
  async getVideoRoom(req: AuthRequest, res: Response) {
    try {
      const room = await consultationService.getOrCreateVideoRoom(
        req.params['id'] as string,
        req.userId!,
        req.userType!,
      );
      return res.json(room);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao preparar sala.';
      const denied = message.includes('acesso') || message.includes('disponível') || message.includes('Aguarde');
      return res.status(denied ? 403 : 404).json({ error: message });
    }
  },

  async createConsultation(req: AuthRequest, res: Response) {
    try {
      const { pet_id, dependent_id, kind, date, time, notes, care_mode, specialty_id, professional_id } = req.body as Record<string, string>;
      if (!date || !time) {
        return res.status(400).json({ error: 'Data e horário são obrigatórios.' });
      }
      const resolvedKind = contextFromPetId(pet_id);
      // Pronto atendimento só pode ser criado via triagem (POST /patient/triages/:id/complete),
      // que insere consultation + care_queue numa transação. Esse endpoint genérico é exclusivo
      // de agendamento com especialista — impede consultas 'pronto' órfãs, sem entrada na fila.
      if (care_mode === 'pronto') {
        return res.status(400).json({ error: 'Pronto atendimento deve ser solicitado via triagem.' });
      }
      const careMode = 'especialista';
      if (kind && kind !== resolvedKind) {
        return res.status(400).json({
          error: kind === 'veterinaria'
            ? 'Selecione um pet para a consulta veterinária.'
            : 'Consultas humanas não podem ser vinculadas a um pet.',
        });
      }

      // Regra de plano decidida no backend (fonte da verdade): se ainda há
      // cota gratuita no mês, esta consulta é registrada como gratuita.
      const quote = await planEntitlementService.quoteForUser(req.userId!, resolvedKind, careMode);
      if (pet_id) {
        const ownedPet = await db('pets')
          .where({ id: pet_id, user_id: req.userId! })
          .whereNull('deleted_at')
          .first();
        if (!ownedPet) return res.status(400).json({ error: 'Pet inválido para este usuário.' });
      }
      if (dependent_id) {
        if (resolvedKind !== 'humana') {
          return res.status(400).json({ error: 'Dependente humano não pode ser vinculado à consulta veterinária.' });
        }
        const ownedDependent = await db('human_dependents')
          .where({ id: dependent_id, user_id: req.userId! })
          .whereNull('deleted_at')
          .first();
        if (!ownedDependent) return res.status(400).json({ error: 'Dependente inválido para este usuário.' });
      }
      if (careMode === 'especialista') {
        if (!specialty_id || !professional_id) return res.status(400).json({ error: 'Selecione especialidade e horário disponível.' });
        const specialty = await db('specialties').where({ id: specialty_id, kind: resolvedKind, active: true }).first();
        if (!specialty) return res.status(400).json({ error: 'Especialidade inválida para o atendimento.' });
        await schedulingService.assertSlot(professional_id, specialty_id, date, time);
      }

      const consultation = await consultationService.create({
        tutor_id: req.userId!,
        vet_id: careMode === 'especialista' ? professional_id : null,
        pet_id: pet_id || null,
        dependent_id: dependent_id || null,
        specialty_id: careMode === 'especialista' ? specialty_id : null,
        date,
        time,
        notes,
        is_free: quote.coveredByPlan,
        charged_value: quote.price,
        care_mode: careMode,
        kind: resolvedKind,
      });

      void consultationEmailService.confirmation(consultation.id);

      res.status(201).json({ ...consultation, quote });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao agendar consulta.';
      logger.error('Erro ao agendar consulta', { message: msg, userId: req.userId });
      res.status(400).json({ error: msg });
    }
  },

  async getEntitlement(req: AuthRequest, res: Response) {
    try {
      const entitlement = await planEntitlementService.getForUser(req.userId!);
      res.json(entitlement);
    } catch (err) {
      logger.error('Erro ao consultar entitlement de plano', {
        message: err instanceof Error ? err.message : String(err),
        userId: req.userId,
      });
      res.status(500).json({ error: 'Erro ao verificar plano.' });
    }
  },

  async getQuote(req: AuthRequest, res: Response) {
    try {
      const kind = req.query['kind'] === 'veterinaria' ? 'veterinaria' : 'humana';
      const careMode = req.query['care_mode'] === 'pronto' ? 'pronto' : 'especialista';
      const quote = await planEntitlementService.quoteForUser(req.userId!, kind, careMode);
      return res.json(quote);
    } catch (err) {
      logger.error('Erro ao calcular orçamento da consulta', { message: err instanceof Error ? err.message : String(err), userId: req.userId });
      return res.status(500).json({ error: 'Erro ao verificar cobertura e preço.' });
    }
  },

  async listTutorConsultations(req: AuthRequest, res: Response) {
    try {
      const consultations = await consultationService.findByTutor(req.userId!);
      res.json(consultations);
    } catch (err) {
      logger.error('Erro ao listar consultas do tutor', { message: err instanceof Error ? err.message : String(err), userId: req.userId });
      res.status(500).json({ error: 'Erro ao listar consultas.' });
    }
  },

  async reschedule(req: AuthRequest, res: Response) {
    try {
      const id = req.params['id'] as string;
      const { date, time, professional_id } = req.body as Record<string, string>;
      const consultation = await db('consultations').where({ id, tutor_id: req.userId!, care_mode: 'especialista' }).first();
      if (!consultation || ['cancelada', 'realizada'].includes(consultation.status)) return res.status(404).json({ error: 'Consulta não disponível para reagendamento.' });
      if (!date || !time || !professional_id || !consultation.specialty_id) return res.status(400).json({ error: 'Data e horário disponíveis são obrigatórios.' });
      await schedulingService.assertSlot(professional_id, consultation.specialty_id, date, time, id);
      const [updated] = await db('consultations').where({ id }).update({ vet_id: professional_id, date, time, status: 'agendada', updated_at: db.fn.now() }).returning('*');
      void consultationEmailService.confirmation(id);
      return res.json(updated);
    } catch (err) { return res.status(400).json({ error: err instanceof Error ? err.message : 'Erro ao reagendar consulta.' }); }
  },
};
