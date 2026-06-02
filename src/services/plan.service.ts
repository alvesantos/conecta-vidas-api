import { db } from '../database/knex';

export interface Perk {
  icon: string;
  label: string;
}

export interface CreatePlanDTO {
  title: string;
  color: string;
  focus: string;
  focus_desc: string;
  price: number;
  free_consultations?: number;
  perks: Perk[];
  is_active?: boolean;
}

export interface UpdatePlanDTO {
  title?: string;
  color?: string;
  focus?: string;
  focus_desc?: string;
  price?: number;
  free_consultations?: number;
  perks?: Perk[];
  is_active?: boolean;
}

function parsePerks(row: Record<string, unknown>) {
  if (!row) return row;
  const perks = row.perks;
  if (typeof perks === 'string') {
    try {
      row.perks = JSON.parse(perks);
    } catch {
      row.perks = [];
    }
  }
  return row;
}

export const planService = {
  async findAll(opts: { includeInactive?: boolean } = {}) {
    const query = db('plans').orderBy('price', 'asc');
    if (!opts.includeInactive) query.where({ is_active: true });
    const rows = await query;
    return rows.map(parsePerks);
  },

  async findById(id: string) {
    const row = await db('plans').where({ id }).first();
    return row ? parsePerks(row) : null;
  },

  async create(data: CreatePlanDTO) {
    const [row] = await db('plans')
      .insert({
        title: data.title,
        color: data.color,
        focus: data.focus,
        focus_desc: data.focus_desc,
        price: data.price,
        free_consultations: data.free_consultations ?? 0,
        perks: JSON.stringify(data.perks ?? []),
        is_active: data.is_active ?? true,
      })
      .returning('*');
    return parsePerks(row);
  },

  async delete(id: string) {
    const count = await db('subscriptions').where({ plan_id: id }).count('id as cnt').first();
    const cnt = Number((count as Record<string, unknown>)?.cnt ?? 0);
    if (cnt > 0) throw new Error('Este plano possui assinaturas e não pode ser excluído.');
    const deleted = await db('plans').where({ id }).delete();
    if (deleted === 0) throw new Error('Plano não encontrado.');
  },

  async update(id: string, data: UpdatePlanDTO) {
    const current = await db('plans').where({ id }).first();
    if (!current) throw new Error('Plano não encontrado.');

    const patch: Record<string, unknown> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.color !== undefined) patch.color = data.color;
    if (data.focus !== undefined) patch.focus = data.focus;
    if (data.focus_desc !== undefined) patch.focus_desc = data.focus_desc;
    if (data.price !== undefined) patch.price = data.price;
    if (data.free_consultations !== undefined) patch.free_consultations = data.free_consultations;
    if (data.perks !== undefined) patch.perks = JSON.stringify(data.perks);
    if (data.is_active !== undefined) patch.is_active = data.is_active;

    if (Object.keys(patch).length > 0) {
      patch.updated_at = db.fn.now();
      await db('plans').where({ id }).update(patch);
    }

    const updated = await db('plans').where({ id }).first();
    return parsePerks(updated);
  },
};
