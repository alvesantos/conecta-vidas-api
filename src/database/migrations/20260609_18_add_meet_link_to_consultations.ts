import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('consultations', (table) => {
    table.text('meet_link').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('consultations', (table) => {
    table.dropColumn('meet_link');
  });
}
