import type { Knex } from 'knex';

// Tabela de pagamentos avulsos (pronto atendimento/especialista fora do plano),
// com split pré-calculado entre profissional e plataforma. Pré-setada: hoje só
// é preenchida em modo "trial_bypass" (THIS_IS_TRIAL_VERSION=true) — cobrança
// real via Asaas Split ainda não está implementada.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('payments', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('consultation_id').notNullable().references('id').inTable('consultations').onDelete('RESTRICT');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('professional_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('kind', 20).notNullable().defaultTo('avulso');
    table.decimal('gross_amount', 10, 2).notNullable();
    table.decimal('professional_share', 10, 2).notNullable();
    table.decimal('platform_share', 10, 2).notNullable();
    table.string('provider', 20).notNullable().defaultTo('asaas');
    table.string('asaas_payment_id').nullable();
    table.string('status', 20).notNullable().defaultTo('pending');
    table.timestamps(true, true);
    table.index(['consultation_id']);
    table.index(['professional_id', 'status']);
  });

  await knex.raw(`
    ALTER TABLE payments ADD CONSTRAINT payments_status_check
    CHECK (status IN ('pending', 'trial_bypass', 'paid', 'failed', 'refunded'))
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('payments');
}
