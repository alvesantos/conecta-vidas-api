import bcrypt from 'bcryptjs';
import { db } from '../database/knex';

export const medicoService = {
  async getProfile(medicoId: string) {
    return db('users')
      .where({ id: medicoId })
      .whereIn('type', ['medico', 'admin'])
      .select('id', 'name', 'cpf', 'email', 'phone', 'crm', 'status', 'created_at')
      .first();
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
        'c.id', 'c.date', 'c.time', 'c.status', 'c.notes', 'c.meet_link',
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
      .where({ 'cr.kind': 'humano' })
      .whereExists(function assignedConsultation() {
        this.select(db.raw('1'))
          .from('consultations as c')
          .whereRaw('c.tutor_id = cr.user_id')
          .andWhere('c.vet_id', medicoId)
          .andWhere('c.kind', 'humana');
      })
      .select(
        'cr.id', 'cr.user_id as patient_id', 'patient.name as patient_name',
        'patient.cpf as patient_cpf', 'cr.blood_type', 'cr.allergies',
        'cr.comorbidities', 'cr.continuous_medications', 'cr.updated_at',
      )
      .orderBy('patient.name');
  },

  async findHumanRecord(medicoId: string, patientId: string) {
    return db('clinical_records as cr')
      .join('users as patient', 'cr.user_id', 'patient.id')
      .where({ 'cr.user_id': patientId, 'cr.kind': 'humano' })
      .whereExists(function assignedConsultation() {
        this.select(db.raw('1'))
          .from('consultations as c')
          .whereRaw('c.tutor_id = cr.user_id')
          .andWhere('c.vet_id', medicoId)
          .andWhere('c.kind', 'humana');
      })
      .select('cr.*', 'patient.name as patient_name', 'patient.cpf as patient_cpf')
      .first();
  },

  async createHumanPrescription(medicoId: string, patientId: string, content: string, date: string) {
    const hasAccess = await db('consultations')
      .where({ tutor_id: patientId, vet_id: medicoId, kind: 'humana' })
      .first();
    if (!hasAccess) throw new Error('Paciente não vinculado a uma consulta médica.');

    const [prescription] = await db('prescriptions')
      .insert({
        vet_id: medicoId,
        user_id: patientId,
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
      .where({ 'pr.vet_id': medicoId, 'pr.kind': 'humana' })
      .whereNull('pr.pet_id')
      .select('pr.id', 'pr.user_id as patient_id', 'patient.name as patient_name', 'pr.content', 'pr.date')
      .orderBy('pr.date', 'desc');
  },
};
