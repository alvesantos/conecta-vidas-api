import { db } from '../database/knex';

export interface CreateConsultationDTO {
  vet_id?: string | null;
  tutor_id: string;
  pet_id?: string | null;
  dependent_id?: string | null;
  date: string;
  time: string;
  notes?: string;
  is_free?: boolean;
  kind: 'humana' | 'veterinaria';
}

export const consultationService = {
  async create(data: CreateConsultationDTO) {
    const isFree = data.is_free ?? false;
    const [consultation] = await db('consultations').insert({
      vet_id: data.vet_id ?? null,
      tutor_id: data.tutor_id,
      pet_id: data.pet_id ?? null,
      dependent_id: data.dependent_id ?? null,
      date: data.date,
      time: data.time,
      notes: data.notes ?? '',
      status: 'agendada',
      is_free: isFree,
      charged_value: isFree ? 0 : null,
      kind: data.kind,
    }).returning('*');

    return consultation;
  },

  async findByTutor(tutorId: string) {
    return db('consultations as c')
      .leftJoin('users as vet', 'c.vet_id', 'vet.id')
      .leftJoin('pets as p', 'c.pet_id', 'p.id')
      .leftJoin('human_dependents as d', 'c.dependent_id', 'd.id')
      .where('c.tutor_id', tutorId)
      .select(
        'c.id', 'c.date', 'c.time', 'c.status', 'c.notes', 'c.meet_link',
        'c.is_free', 'c.charged_value', 'c.kind', 'c.pet_id', 'c.dependent_id',
        'vet.name as vet_name',
        'p.name as pet_name',
        'd.name as dependent_name',
        'c.created_at'
      )
      .orderBy('c.date', 'desc')
      .orderBy('c.time', 'desc');
  },

  async findAll() {
    return db('consultations as c')
      .join('users as tutor', 'c.tutor_id', 'tutor.id')
      .leftJoin('users as vet', 'c.vet_id', 'vet.id')
      .leftJoin('pets as p', 'c.pet_id', 'p.id')
      .select(
        'c.id', 'c.date', 'c.time', 'c.status', 'c.notes', 'c.vet_id',
        'tutor.name as tutor_name',
        'vet.name as vet_name',
        'p.name as pet_name',
        'c.created_at'
      )
      .orderBy('c.date', 'desc')
      .orderBy('c.time', 'desc');
  },

  async assignVet(id: string, vetId: string) {
    return db('consultations')
      .where({ id })
      .update({ vet_id: vetId, updated_at: db.fn.now() });
  }
};
