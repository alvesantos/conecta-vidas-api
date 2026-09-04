import bcrypt from 'bcryptjs';
import { db } from '../database/knex';

export const medicoService = {
  async getDashboardStats(medicoId: string) {
    const today = await db('consultations')
      .where({ vet_id: medicoId, kind: 'humana', date: db.raw('CURRENT_DATE') })
      .count('* as count').first();
    
    const totalClients = await db('consultations')
      .where({ vet_id: medicoId, kind: 'humana', status: 'realizada' })
      .countDistinct('tutor_id as count').first();

    const pendingConsultations = await db('consultations')
      .where({ vet_id: medicoId, kind: 'humana' })
      .whereIn('status', ['agendada', 'confirmada'])
      .count('* as count').first();

    const recentConsultations = await db('consultations as c')
      .join('users as patient', 'c.tutor_id', 'patient.id')
      .leftJoin('human_dependents as dependent', 'c.dependent_id', 'dependent.id')
      .where({ 'c.vet_id': medicoId, 'c.kind': 'humana', 'c.date': db.raw('CURRENT_DATE') })
      .select(
        'c.id', 'c.time', 'c.status', 'c.care_mode as type',
        db.raw("COALESCE(dependent.name, patient.name) as patient_name")
      )
      .orderBy('c.time', 'asc')
      .limit(5);

    return {
      stats: {
        today: Number(today?.count || 0),
        totalClients: Number(totalClients?.count || 0),
        pendingConsultations: Number(pendingConsultations?.count || 0),
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

  async getProfile(medicoId: string) {
    return db('users')
      .where({ id: medicoId })
      .whereIn('type', ['medico', 'admin'])
      .select(
        'id', 'name', 'cpf', 'email', 'phone', 'crm', 'status', 'created_at',
        'pix_type', 'pix_key',
        'bank_code', 'bank_name', 'bank_agency', 'bank_account_number',
        'bank_account_digit', 'bank_account_type',
      )
      .first();
  },

  async updateFinanceiro(medicoId: string, data: Record<string, string | null>) {
    const {
      pix_type, pix_key,
      bank_code, bank_name, bank_agency, bank_account_number,
      bank_account_digit, bank_account_type,
    } = data;

    await db('users').where({ id: medicoId }).update({
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

    return this.getProfile(medicoId);
  },

  async changePassword(medicoId: string, currentPassword: string, newPassword: string) {
    const user = await db('users').where({ id: medicoId }).first();
    if (!user) throw new Error('Usuário não encontrado.');

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) throw new Error('Senha atual incorreta.');

    const password = await bcrypt.hash(newPassword, 10);
    await db('users')
      .where({ id: medicoId })
      .update({ password, updated_at: db.fn.now() });
  },

  async findConsultations(medicoId: string, date?: string) {
    const query = db('consultations as c')
      .join('users as patient', 'c.tutor_id', 'patient.id')
      .where({ 'c.vet_id': medicoId, 'c.kind': 'humana' })
      .select(
        'c.id', 'c.date', 'c.time', 'c.status', 'c.notes',
        'c.kind', 'patient.id as patient_id', 'patient.name as patient_name',
        'c.created_at',
      )
      .orderBy('c.date', 'desc')
      .orderBy('c.time', 'desc');

    if (date) query.where('c.date', date);
    return query;
  },

  async findHumanRecords(medicoId: string) {
    return db('clinical_records as cr')
      .join('users as patient', 'cr.user_id', 'patient.id')
      .leftJoin('human_dependents as dependent', 'cr.dependent_id', 'dependent.id')
      .where({ 'cr.kind': 'humano' })
      .whereExists(function assignedConsultation() {
        this.select(db.raw('1'))
          .from('consultations as c')
          .whereRaw('c.tutor_id = cr.user_id')
          .whereRaw('c.dependent_id IS NOT DISTINCT FROM cr.dependent_id')
          .andWhere('c.vet_id', medicoId)
          .andWhere('c.kind', 'humana');
      })
      .select(
        'cr.id', 'cr.user_id as patient_id', 'cr.dependent_id',
        db.raw('COALESCE(dependent.name, patient.name) as patient_name'),
        'patient.cpf as patient_cpf', 'cr.blood_type', 'cr.allergies',
        'cr.comorbidities', 'cr.continuous_medications', 'cr.updated_at',
      )
      .orderByRaw('COALESCE(dependent.name, patient.name)');
  },

  async findHumanRecord(medicoId: string, recordId: string) {
    return db('clinical_records as cr')
      .join('users as patient', 'cr.user_id', 'patient.id')
      .leftJoin('human_dependents as dependent', 'cr.dependent_id', 'dependent.id')
      .where({ 'cr.id': recordId, 'cr.kind': 'humano' })
      .whereExists(function assignedConsultation() {
        this.select(db.raw('1'))
          .from('consultations as c')
          .whereRaw('c.tutor_id = cr.user_id')
          .whereRaw('c.dependent_id IS NOT DISTINCT FROM cr.dependent_id')
          .andWhere('c.vet_id', medicoId)
          .andWhere('c.kind', 'humana');
      })
      .select('cr.*', db.raw('COALESCE(dependent.name, patient.name) as patient_name'), db.raw('COALESCE(dependent.cpf, patient.cpf) as patient_cpf'))
      .first();
  },

  async createHumanPrescription(medicoId: string, patientId: string, dependentId: string | null, content: string, date: string) {
    const hasAccess = await db('consultations')
      .where({ tutor_id: patientId, vet_id: medicoId, kind: 'humana', dependent_id: dependentId })
      .first();
    if (!hasAccess) throw new Error('Paciente não vinculado a uma consulta médica.');

    const [prescription] = await db('prescriptions')
      .insert({
        vet_id: medicoId,
        user_id: patientId,
        dependent_id: dependentId,
        pet_id: null,
        content,
        date,
        kind: 'humana',
      })
      .returning('*');
    return prescription;
  },

  async findHumanPrescriptions(medicoId: string) {
    return db('prescriptions as pr')
      .join('users as patient', 'pr.user_id', 'patient.id')
      .leftJoin('human_dependents as dependent', 'pr.dependent_id', 'dependent.id')
      .where({ 'pr.vet_id': medicoId, 'pr.kind': 'humana' })
      .whereNull('pr.pet_id')
      .select('pr.id', 'pr.user_id as patient_id', 'pr.dependent_id', db.raw('COALESCE(dependent.name, patient.name) as patient_name'), 'pr.content', 'pr.date')
      .orderBy('pr.date', 'desc');
  },
};
