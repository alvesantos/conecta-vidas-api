import { db } from '../database/knex';
import { careQueueService } from './careQueue.service';

const PAGARME_API = 'https://api.pagar.me/core/v5';
const PAGARME_SECRET = process.env.PAGARME_SECRET_KEY ?? '';

function pagarmeHeaders() {
  const auth = Buffer.from(`${PAGARME_SECRET}:`).toString('base64');
  return {
    'Content-Type': 'application/json',
    Authorization: `Basic ${auth}`,
  };
}

export interface CreateRecipientDTO {
  name: string;
  email: string;
  cnpj: string;
  pix_type: string;
  pix_key: string;
  bank_code: string;
  bank_name: string;
  bank_agency: string;
  bank_account_number: string;
  bank_account_digit: string;
  bank_account_type: string;
  bank_holder_type: string;
  billing_street: string;
  billing_number: string;
  billing_complement?: string;
  billing_neighborhood: string;
  billing_city: string;
  billing_state: string;
  billing_cep: string;
}

export const vetService = {
  async getDashboardStats(vetId: string) {
    const today = await db('consultations')
      .where({ vet_id: vetId, kind: 'veterinaria', date: db.raw('CURRENT_DATE') })
      .count('* as count').first();
    
    const week = await db('consultations')
      .where({ vet_id: vetId, kind: 'veterinaria' })
      .andWhereRaw("date >= CURRENT_DATE - INTERVAL '7 days'")
      .count('* as count').first();

    const totalClients = await db('consultations')
      .where({ vet_id: vetId, kind: 'veterinaria' })
      .countDistinct('tutor_id as count').first();

    const pendingRecords = await db('consultations')
      .where({ vet_id: vetId, kind: 'veterinaria', status: 'agendada' })
      .andWhereRaw("date < CURRENT_DATE")
      .count('* as count').first();

    const recentConsultations = await db('consultations as c')
      .join('pets', 'c.pet_id', 'pets.id')
      .where({ 'c.vet_id': vetId, 'c.kind': 'veterinaria', 'c.date': db.raw('CURRENT_DATE') })
      .select(
        'c.id', 'c.time', 'c.status', 'c.care_mode as type',
        'pets.name as patient_name'
      )
      .orderBy('c.time', 'asc')
      .limit(5);

    return {
      stats: {
        today: Number(today?.count || 0),
        week: Number(week?.count || 0),
        totalClients: Number(totalClients?.count || 0),
        pendingRecords: Number(pendingRecords?.count || 0),
      },
      recentConsultations: recentConsultations.map(c => ({
        id: c.id,
        patient: c.patient_name,
        time: String(c.time).substring(0, 5),
        type: c.type === 'pronto' ? 'Pronto Atendimento' : 'Especialista',
        status: String(c.status).charAt(0).toUpperCase() + String(c.status).slice(1)
      }))
    };
  },

  async createRecipient(data: CreateRecipientDTO): Promise<string> {
    const cnpjClean = data.cnpj.replace(/\D/g, '');

    const body = {
      name: data.name,
      email: data.email,
      document: cnpjClean,
      type: 'company',
      default_bank_account: {
        holder_name: data.name.slice(0, 30),
        holder_type: data.bank_holder_type,
        holder_document: cnpjClean,
        bank: data.bank_code,
        branch_number: data.bank_agency,
        account_number: data.bank_account_number,
        account_check_digit: data.bank_account_digit,
        type: data.bank_account_type === 'corrente' ? 'checking' : 'savings',
      },
      transfer_settings: {
        transfer_enabled: true,
        transfer_interval: 'Monthly',
        transfer_day: 5,
      },
    };

    const response = await fetch(`${PAGARME_API}/recipients`, {
      method: 'POST',
      headers: pagarmeHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = (err as Record<string, unknown>).message || 'Erro ao criar recebedor no Pagar.me';
      throw new Error(String(msg));
    }

    const result = (await response.json()) as { id: string };
    return result.id;
  },

  async findAllVets() {
    return db('users')
      .where({ type: 'veterinario' })
      .select(
        'id', 'name', 'cnpj', 'email', 'recipient_id', 'type', 'created_at',
        'pix_type', 'pix_key',
        'bank_code', 'bank_name', 'bank_agency', 'bank_account_number',
        'bank_account_digit', 'bank_account_type', 'bank_holder_type',
        'billing_cep', 'billing_street', 'billing_number', 'billing_complement',
        'billing_neighborhood', 'billing_city', 'billing_state',
        'crmv', 'available_now', 'available_since',
      )
      .orderBy('created_at', 'desc');
  },

  async getBalance(recipientId: string) {
    const response = await fetch(`${PAGARME_API}/recipients/${recipientId}/balance`, {
      headers: pagarmeHeaders(),
    });

    if (!response.ok) {
      throw new Error('Erro ao consultar saldo no Pagar.me');
    }

    return response.json();
  },

  async findConsultationsByVet(vetId: string, dateFilter?: string) {
    const query = db('consultations as c')
      .join('users as tutor', 'c.tutor_id', 'tutor.id')
      .leftJoin('pets as p', 'c.pet_id', 'p.id')
      .where('c.vet_id', vetId)
      .andWhere('c.kind', 'veterinaria')
      .select(
        'c.id', 'c.date', 'c.time', 'c.status', 'c.notes', 'c.notes_visible_to_patient',
        'tutor.name as tutor_name',
        'p.name as pet_name',
        'c.created_at',
      )
      .orderBy('c.date', 'desc')
      .orderBy('c.time', 'desc');

    if (dateFilter) {
      query.where('c.date', dateFilter);
    }

    return query;
  },

  /** Salva o link da videoconferência e/ou as anotações ao vivo da consulta. */
  async saveConsultationSession(
    consultationId: string,
    vetId: string,
    data: { notes?: string; notes_visible_to_patient?: boolean },
  ) {
    const consultation = await db('consultations')
      .where({ id: consultationId, vet_id: vetId, kind: 'veterinaria' })
      .first();

    if (!consultation) throw new Error('Consulta não encontrada.');

    const update: Record<string, unknown> = { updated_at: db.fn.now() };
    if (data.notes !== undefined) update['notes'] = data.notes;
    if (data.notes_visible_to_patient !== undefined) update['notes_visible_to_patient'] = data.notes_visible_to_patient;

    await db('consultations').where({ id: consultationId }).update(update);

    return db('consultations').where({ id: consultationId }).first();
  },

  async updateConsultationStatus(consultationId: string, vetId: string, status: string, notes?: string, notesVisibleToPatient?: boolean) {
    const consultation = await db('consultations')
      .where({ id: consultationId, vet_id: vetId, kind: 'veterinaria' })
      .first();

    if (!consultation) throw new Error('Consulta não encontrada.');

    await db.transaction(async (trx) => {
      const consultationUpdate: Record<string, unknown> = { status, updated_at: db.fn.now() };
      if (notes !== undefined) consultationUpdate['notes'] = notes;
      if (notesVisibleToPatient !== undefined) consultationUpdate['notes_visible_to_patient'] = notesVisibleToPatient;

      await trx('consultations')
        .where({ id: consultationId })
        .update(consultationUpdate);

      await careQueueService.syncOnConsultationStatus(trx, consultationId, status);

      if (status === 'realizada') {
        const dateStr = consultation.date instanceof Date ? consultation.date.toISOString().slice(0, 10) : consultation.date;
        const sessionNotes = (notes ?? consultation.notes ?? '').trim();
        const content =
          `Prontuário gerado a partir da consulta do dia ${dateStr}\n\n` +
          `Anotações da consulta:\n${sessionNotes || '(sem anotações registradas)'}`;

        const existing = await trx('medical_records').where({ consultation_id: consultationId }).first();
        if (existing) {
          await trx('medical_records')
            .where({ consultation_id: consultationId })
            .update({ content, updated_at: db.fn.now() });
        } else {
          await trx('medical_records').insert({
            consultation_id: consultationId,
            vet_id: vetId,
            tutor_id: consultation.tutor_id,
            pet_id: consultation.pet_id,
            content,
          });
        }
      }
    });

    return db('consultations').where({ id: consultationId }).first();
  },

  async getVetProfile(vetId: string) {
    // Admin também pode atuar como veterinário, por isso não restringimos o type aqui.
    return db('users')
      .where({ id: vetId })
      .whereIn('type', ['veterinario', 'admin'])
      .select(
        'id', 'name', 'cnpj', 'email', 'recipient_id',
        'pix_type', 'pix_key',
        'bank_code', 'bank_name', 'bank_agency', 'bank_account_number',
        'bank_account_digit', 'bank_account_type', 'bank_holder_type',
        'billing_cep', 'billing_street', 'billing_number', 'billing_complement',
        'billing_neighborhood', 'billing_city', 'billing_state',
        'crmv',
        'available_now', 'available_since',
        'created_at',
      )
      .first();
  },

  async updateFinanceiro(vetId: string, data: Record<string, string | null>) {
    const {
      pix_type, pix_key,
      bank_code, bank_name, bank_agency, bank_account_number,
      bank_account_digit, bank_account_type,
    } = data;

    await db('users').where({ id: vetId }).update({
      pix_type: pix_type ?? null,
      pix_key: pix_key ?? null,
      bank_code: bank_code ?? null,
      bank_name: bank_name ?? null,
      bank_agency: bank_agency ?? null,
      bank_account_number: bank_account_number ?? null,
      bank_account_digit: bank_account_digit ?? null,
      bank_account_type: bank_account_type ?? null,
      updated_at: db.fn.now(),
    });

    return this.getVetProfile(vetId);
  },

  async changePassword(vetId: string, currentPassword: string, newPassword: string) {
    const bcrypt = await import('bcryptjs');
    const user = await db('users').where({ id: vetId }).first();
    if (!user) throw new Error('Usuário não encontrado.');

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) throw new Error('Senha atual incorreta.');

    const hashed = await bcrypt.hash(newPassword, 10);
    await db('users').where({ id: vetId }).update({ password: hashed, updated_at: db.fn.now() });
  },
};
