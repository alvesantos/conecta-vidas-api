import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('prescriptions', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('vet_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('pet_id').nullable().references('id').inTable('pets').onDelete('SET NULL');
    table.text('content').notNullable();
    table.date('date').notNullable();
    table.timestamps(true, true);

    table.index(['vet_id']);
    table.index(['user_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('prescriptions');
}
