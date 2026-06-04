import { db } from '../database/knex';

export const medicalRecordService = {
  async findByVet(vetId: string) {
    return db('medical_records as mr')
      .join('users as tutor', 'mr.tutor_id', 'tutor.id')
      .leftJoin('pets as p', 'mr.pet_id', 'p.id')
      .join('consultations as c', 'mr.consultation_id', 'c.id')
      .where('mr.vet_id', vetId)
      .select(
        'mr.id',
        'mr.created_at',
        'c.date as consultation_date',
        'tutor.name as tutor_name',
        'p.name as pet_name',
      )
      .orderBy('c.date', 'desc')
      .orderBy('mr.created_at', 'desc');
  },

  async findById(id: string) {
    return db('medical_records as mr')
      .join('users as tutor', 'mr.tutor_id', 'tutor.id')
      .join('users as vet', 'mr.vet_id', 'vet.id')
      .leftJoin('pets as p', 'mr.pet_id', 'p.id')
      .join('consultations as c', 'mr.consultation_id', 'c.id')
      .where('mr.id', id)
      .select(
        'mr.id', 'mr.content', 'mr.created_at',
        'c.date as consultation_date',
        'tutor.name as tutor_name',
        'tutor.cpf as tutor_cpf',
        'tutor.email as tutor_email',
        'vet.name as vet_name',
        'vet.crmv as vet_crmv',
        'p.name as pet_name',
        'p.species as pet_species',
        'p.breed as pet_breed',
        'mr.vet_id'
      )
      .first();
  },

  async updateContent(id: string, content: string) {
    await db('medical_records')
      .where({ id })
      .update({ content, updated_at: db.fn.now() });
    return this.findById(id);
  }
};
