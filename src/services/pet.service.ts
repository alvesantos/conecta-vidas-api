import { db } from '../database/knex';
import type { Knex } from 'knex';

export interface CreatePetDTO {
  user_id: string;
  name: string;
  species: string;
  breed: string;
  size?: string | null;
  coat?: string | null;
  coat_color?: string;
  birth_date: string;
  microchipped: boolean;
  neutered: boolean;
  weight?: number | null;
  sex?: string | null;
  behavior?: string;
  conditions?: string;
  avatar_url?: string;
}

export interface UpdatePetDTO {
  name?: string;
  species?: string;
  breed?: string;
  size?: string;
  coat?: string;
  coat_color?: string | null;
  birth_date?: string;
  microchipped?: boolean;
  neutered?: boolean;
  weight?: number | null;
  sex?: string | null;
  behavior?: string | null;
  conditions?: string | null;
  avatar_url?: string | null;
}

const MAX_PETS_PER_USER = 5;

async function countUserPets(userId: string, connection: Knex | Knex.Transaction = db): Promise<number> {
  const [{ count }] = await connection('pets')
    .where({ user_id: userId })
    .whereNull('deleted_at')
    .count<{ count: string }[]>('id as count');
  return Number(count ?? 0);
}

export const petService = {
  async create(data: CreatePetDTO, connection: Knex | Knex.Transaction = db) {
    const owner = await connection('users').where({ id: data.user_id }).first();
    if (!owner) throw new Error('Tutor não encontrado.');

    const current = await countUserPets(data.user_id, connection);
    if (current >= MAX_PETS_PER_USER) {
      throw new Error(`Limite de ${MAX_PETS_PER_USER} pets atingido.`);
    }

    const [pet] = await connection('pets').insert(data).returning('*');
    await connection('clinical_records').insert({
      user_id: data.user_id,
      pet_id: pet.id,
      kind: 'veterinario',
    });
    return pet;
  },

  async findByUser(userId: string) {
    return db('pets').where({ user_id: userId }).whereNull('deleted_at').orderBy('created_at', 'desc');
  },

  async findAll() {
    return db('pets').whereNull('deleted_at').orderBy('created_at', 'desc');
  },

  async findBirthdayPetsThisMonth() {
    return db('pets as p')
      .leftJoin('users as u', 'p.user_id', 'u.id')
      .select(
        'p.id', 'p.name', 'p.species', 'p.breed', 'p.birth_date', 'p.avatar_url',
        'u.id as owner_id', 'u.name as owner_name', 'u.email as owner_email'
      )
      .whereNull('p.deleted_at')
      .whereRaw('EXTRACT(MONTH FROM p.birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)')
      .orderByRaw('EXTRACT(DAY FROM p.birth_date)');
  },

  async findAllWithOwner() {
    return db('pets as p')
      .leftJoin('users as u', 'p.user_id', 'u.id')
      .select(
        'p.*',
        'u.id as owner_id',
        'u.name as owner_name',
        'u.email as owner_email'
      )
      .whereNull('p.deleted_at')
      .orderBy('p.created_at', 'desc');
  },

  async findById(id: string) {
    return db('pets').where({ id }).whereNull('deleted_at').first();
  },

  async findByIdWithOwner(id: string) {
    return db('pets as p')
      .leftJoin('users as u', 'p.user_id', 'u.id')
      .where('p.id', id)
      .whereNull('p.deleted_at')
      .select(
        'p.*',
        'u.id as owner_id',
        'u.name as owner_name',
        'u.email as owner_email',
        'u.cpf as owner_cpf',
        'u.address as owner_address'
      )
      .first();
  },

  async update(id: string, data: UpdatePetDTO) {
    const current = await db('pets').where({ id }).first();
    if (!current) throw new Error('Pet não encontrado.');

    const patch: Record<string, unknown> = {};
    for (const key of [
      'name', 'species', 'breed', 'size', 'coat', 'coat_color', 'birth_date',
      'microchipped', 'neutered', 'weight', 'sex', 'behavior', 'conditions', 'avatar_url',
    ] as const) {
      if (data[key] !== undefined) patch[key] = data[key];
    }

    if (Object.keys(patch).length > 0) {
      patch.updated_at = db.fn.now();
      await db('pets').where({ id }).update(patch);
    }

    return db('pets').where({ id }).first();
  },

  async remove(id: string) {
    const deleted = await db('pets')
      .where({ id })
      .whereNull('deleted_at')
      .update({ deleted_at: db.fn.now(), updated_at: db.fn.now() });
    if (deleted === 0) throw new Error('Pet não encontrado.');
  },
};
