import { db } from '../../database/knex';
import { asaasRequest } from './asaasClient';

interface AsaasCustomerResponse { id: string }

/** Garante que o usuário tem um customer no Asaas, criando se necessário. Retorna o asaas_customer_id. */
export async function ensureAsaasCustomer(userId: string): Promise<string> {
  const user = await db('users').where({ id: userId }).select('id', 'name', 'email', 'cpf', 'phone', 'asaas_customer_id').first();
  if (!user) throw new Error('Usuário não encontrado.');
  if (user.asaas_customer_id) return user.asaas_customer_id;

  const created = await asaasRequest<AsaasCustomerResponse>('/customers', {
    method: 'POST',
    body: {
      name: user.name,
      email: user.email,
      cpfCnpj: String(user.cpf ?? '').replace(/\D/g, ''),
      mobilePhone: user.phone ? String(user.phone).replace(/\D/g, '') : undefined,
      externalReference: user.id,
    },
  });

  await db('users').where({ id: userId }).update({ asaas_customer_id: created.id, updated_at: db.fn.now() });
  return created.id;
}
