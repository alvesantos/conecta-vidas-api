import bcrypt from 'bcryptjs';
import { db } from '../database/knex';
import type { UserType } from '../middlewares/auth.middleware';

export interface CreateUserDTO {
  name: string;
  cpf?: string | null;
  cnpj?: string | null;
  email: string;
  address?: string | null;
  password: string;
  type?: UserType;
  pix_type?: string | null;
  pix_key?: string | null;
  bank_code?: string | null;
  bank_name?: string | null;
  bank_agency?: string | null;
  bank_account_number?: string | null;
  bank_account_digit?: string | null;
  bank_account_type?: string | null;
  bank_holder_type?: string | null;
  billing_cep?: string | null;
  billing_street?: string | null;
  billing_number?: string | null;
  billing_complement?: string | null;
  billing_neighborhood?: string | null;
  billing_city?: string | null;
  billing_state?: string | null;
  recipient_id?: string | null;
  crmv?: string | null;
  zip_code?: string | null;
  house_number?: string | null;
}

export interface UpdateUserDTO {
  name?: string;
  email?: string;
  address?: string | null;
  type?: UserType;
  crmv?: string | null;
  zip_code?: string | null;
  house_number?: string | null;
}

export interface LoginDTO {
  email: string;
  password: string;
}

const PUBLIC_COLUMNS = [
  'id', 'name', 'cpf', 'cnpj', 'email', 'address', 'type', 'created_at',
  'recipient_id', 'pix_type', 'pix_key',
  'bank_code', 'bank_name', 'bank_agency', 'bank_account_number',
  'bank_account_digit', 'bank_account_type', 'bank_holder_type',
  'billing_cep', 'billing_street', 'billing_number', 'billing_complement',
  'billing_neighborhood', 'billing_city', 'billing_state',
  'crmv', 'zip_code', 'house_number',
];

export const userService = {
  async create(data: CreateUserDTO) {
    const conflict = await db('users')
      .where({ email: data.email })
      .modify((qb) => {
        if (data.cpf) qb.orWhere({ cpf: data.cpf });
        if (data.cnpj) qb.orWhere({ cnpj: data.cnpj });
      })
      .first();

    if (conflict) {
      throw new Error('E-mail, CPF ou CNPJ já cadastrado.');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const [user] = await db('users')
      .insert({
        name: data.name,
        cpf: data.cpf ?? null,
        cnpj: data.cnpj ?? null,
        email: data.email,
        address: data.address ?? null,
        password: hashedPassword,
        type: data.type ?? 'tutor',
        recipient_id: data.recipient_id ?? null,
        pix_type: data.pix_type ?? null,
        pix_key: data.pix_key ?? null,
        bank_code: data.bank_code ?? null,
        bank_name: data.bank_name ?? null,
        bank_agency: data.bank_agency ?? null,
        bank_account_number: data.bank_account_number ?? null,
        bank_account_digit: data.bank_account_digit ?? null,
        bank_account_type: data.bank_account_type ?? null,
        bank_holder_type: data.bank_holder_type ?? null,
        billing_cep: data.billing_cep ?? null,
        billing_street: data.billing_street ?? null,
        billing_number: data.billing_number ?? null,
        billing_complement: data.billing_complement ?? null,
        billing_neighborhood: data.billing_neighborhood ?? null,
        billing_city: data.billing_city ?? null,
        billing_state: data.billing_state ?? null,
        crmv: data.crmv ?? null,
        zip_code: data.zip_code ?? null,
        house_number: data.house_number ?? null,
      })
      .returning(PUBLIC_COLUMNS);

    return user;
  },

  async findAll() {
    return db('users').select(PUBLIC_COLUMNS).orderBy('created_at', 'desc');
  },

  async findById(id: string) {
    return db('users').where({ id }).select(PUBLIC_COLUMNS).first();
  },

  async update(id: string, data: UpdateUserDTO) {
    const current = await db('users').where({ id }).first();
    if (!current) throw new Error('Usuário não encontrado.');

    if (data.email && data.email !== current.email) {
      const conflict = await db('users').where({ email: data.email }).first();
      if (conflict) throw new Error('E-mail já está em uso por outro usuário.');
    }

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.email !== undefined) patch.email = data.email;
    if (data.address !== undefined) patch.address = data.address;
    if (data.type !== undefined) patch.type = data.type;
    if (data.crmv !== undefined) patch.crmv = data.crmv;
    if (data.zip_code !== undefined) patch.zip_code = data.zip_code;
    if (data.house_number !== undefined) patch.house_number = data.house_number;

    if (Object.keys(patch).length > 0) {
      patch.updated_at = db.fn.now();
      await db('users').where({ id }).update(patch);
    }

    return this.findById(id);
  },

  async remove(id: string) {
    const deleted = await db('users').where({ id }).delete();
    if (deleted === 0) throw new Error('Usuário não encontrado.');
  },

  async login(data: LoginDTO) {
    const user = await db('users').where({ email: data.email }).first();
    if (!user) throw new Error('E-mail ou senha inválidos.');

    const passwordMatch = await bcrypt.compare(data.password, user.password);
    if (!passwordMatch) throw new Error('E-mail ou senha inválidos.');

    const { password: _pwd, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },
};
