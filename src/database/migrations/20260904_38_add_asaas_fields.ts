import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.string('asaas_customer_id').nullable();
  });

  await knex.schema.alterTable('subscriptions', (table) => {
    table.string('asaas_payment_id').nullable().unique();
    table.text('checkout_url').nullable();
    table.timestamp('expires_at').nullable();
  });

  await knex.raw('ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check');
  await knex.raw(`
    ALTER TABLE subscriptions
    ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('pending_payment', 'active', 'canceled'))
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check');
  await knex.raw(`
    ALTER TABLE subscriptions
    ADD CONSTRAINT subscriptions_status_check
    CHECK (status IN ('active', 'canceled'))
  `);

  await knex.schema.alterTable('subscriptions', (table) => {
    table.dropColumn('asaas_payment_id');
    table.dropColumn('checkout_url');
    table.dropColumn('expires_at');
  });

  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('asaas_customer_id');
  });
}
