import { db } from '../database/knex';

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
      .select(
        'c.id', 'c.date', 'c.time', 'c.status', 'c.notes',
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

  async updateConsultationStatus(consultationId: string, vetId: string, status: string) {
    const consultation = await db('consultations')
      .where({ id: consultationId, vet_id: vetId })
      .first();

    if (!consultation) throw new Error('Consulta não encontrada.');

    await db('consultations')
      .where({ id: consultationId })
      .update({ status, updated_at: db.fn.now() });

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
        'created_at',
      )
      .first();
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
