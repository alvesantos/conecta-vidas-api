import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.string('address_complement').nullable();
    table.string('address_neighborhood').nullable();
    table.string('address_city').nullable();
    table.string('address_state', 2).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('address_state');
    table.dropColumn('address_city');
    table.dropColumn('address_neighborhood');
    table.dropColumn('address_complement');
  });
}
