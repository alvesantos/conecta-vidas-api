import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('pets', (table) => {
    table.decimal('weight', 6, 2).nullable();
    table.string('sex', 20).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('pets', (table) => {
    table.dropColumn('weight');
    table.dropColumn('sex');
  });
}
