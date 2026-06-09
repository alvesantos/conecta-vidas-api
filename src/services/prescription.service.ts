import { db } from '../database/knex';

export interface CreatePrescriptionDTO {
  vet_id: string;
  user_id: string;
  pet_id?: string | null;
  content: string;
  date: string;
}

export const prescriptionService = {
  /** Lista os responsáveis (tutores) para o select de nova prescrição. */
  async findResponsibles() {
    return db('users')
      .where({ type: 'tutor' })
      .select('id', 'name', 'cpf', 'email', 'address')
      .orderBy('name', 'asc');
  },

  /** Lista os animais de um responsável específico. */
  async findPetsByResponsible(userId: string) {
    return db('pets')
      .where({ user_id: userId })
      .select(
        'id', 'name', 'species', 'breed', 'size', 'coat', 'coat_color',
        'birth_date', 'microchipped', 'neutered', 'weight', 'sex',
        'behavior', 'conditions',
      )
      .orderBy('name', 'asc');
  },

  async create(data: CreatePrescriptionDTO) {
    const [prescription] = await db('prescriptions')
      .insert({
        vet_id: data.vet_id,
        user_id: data.user_id,
        pet_id: data.pet_id ?? null,
        content: data.content,
        date: data.date,
      })
      .returning('*');

    return this.findById(prescription.id);
  },

  async findByVet(vetId: string) {
    return db('prescriptions as pr')
      .join('users as resp', 'pr.user_id', 'resp.id')
      .leftJoin('pets as p', 'pr.pet_id', 'p.id')
      .where('pr.vet_id', vetId)
      .select(
        'pr.id', 'pr.content', 'pr.date', 'pr.created_at',
        'resp.name as responsible_name',
        'p.name as pet_name',
      )
      .orderBy('pr.date', 'desc')
      .orderBy('pr.created_at', 'desc');
  },

  async findById(id: string) {
    return db('prescriptions as pr')
      .join('users as resp', 'pr.user_id', 'resp.id')
      .join('users as vet', 'pr.vet_id', 'vet.id')
      .leftJoin('pets as p', 'pr.pet_id', 'p.id')
      .where('pr.id', id)
      .select(
        'pr.id', 'pr.content', 'pr.date', 'pr.created_at',
        'pr.user_id', 'pr.pet_id', 'pr.vet_id',
        'resp.name as responsible_name',
        'resp.cpf as responsible_cpf',
        'resp.email as responsible_email',
        'resp.address as responsible_address',
        'vet.name as vet_name',
        'vet.crmv as vet_crmv',
        'p.name as pet_name',
        'p.species as pet_species',
        'p.breed as pet_breed',
        'p.size as pet_size',
        'p.coat as pet_coat',
        'p.coat_color as pet_coat_color',
        'p.birth_date as pet_birth_date',
        'p.weight as pet_weight',
        'p.sex as pet_sex',
        'p.microchipped as pet_microchipped',
        'p.neutered as pet_neutered',
      )
      .first();
  },

  /** Remove uma prescrição garantindo que pertence ao veterinário informado. */
  async remove(id: string, vetId: string) {
    const deleted = await db('prescriptions')
      .where({ id, vet_id: vetId })
      .del();
    return deleted > 0;
  },
};
