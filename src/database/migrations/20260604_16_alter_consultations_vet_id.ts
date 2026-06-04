import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('consultations', (table) => {
    table.uuid('vet_id').nullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('consultations', (table) => {
    table.uuid('vet_id').notNullable().alter();
  });
}
