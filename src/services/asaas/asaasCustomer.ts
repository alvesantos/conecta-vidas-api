import { db } from '../../database/knex';
import { asaasRequest } from './asaasClient';

interface AsaasCustomerResponse { id: string }

/**
 * Garante que o usuário tem um customer no Asaas, criando se necessário.
 * O Asaas Checkout (diferente da fatura simples /payments) exige endereço
 * completo no customer — por isso mandamos tudo que já coletamos no cadastro
 * (zip_code, address, house_number, address_city, address_state).
 */
export async function ensureAsaasCustomer(userId: string): Promise<string> {
  const user = await db('users').where({ id: userId }).select(
    'id', 'name', 'email', 'cpf', 'phone', 'asaas_customer_id',
    'zip_code', 'address', 'house_number', 'address_city', 'address_state',
  ).first();
  if (!user) throw new Error('Usuário não encontrado.');
  if (user.asaas_customer_id) return user.asaas_customer_id;

  if (!user.zip_code || !user.address || !user.house_number || !user.address_city || !user.address_state) {
    throw new Error('Complete seu endereço (CEP, endereço e número) no cadastro antes de assinar um plano.');
  }

  const created = await asaasRequest<AsaasCustomerResponse>('/customers', {
    method: 'POST',
    body: {
      name: user.name,
      email: user.email,
      cpfCnpj: String(user.cpf ?? '').replace(/\D/g, ''),
      mobilePhone: user.phone ? String(user.phone).replace(/\D/g, '') : undefined,
      postalCode: String(user.zip_code).replace(/\D/g, ''),
      address: user.address,
      addressNumber: user.house_number,
      province: user.address_state,
      city: user.address_city,
      externalReference: user.id,
    },
  });

  await db('users').where({ id: userId }).update({ asaas_customer_id: created.id, updated_at: db.fn.now() });
  return created.id;
}
