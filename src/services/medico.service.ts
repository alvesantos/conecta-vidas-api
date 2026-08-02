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
};
