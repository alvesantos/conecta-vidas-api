import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('medical_records', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('consultation_id').notNullable().references('id').inTable('consultations').onDelete('CASCADE');
    table.uuid('vet_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('tutor_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('pet_id').nullable().references('id').inTable('pets').onDelete('SET NULL');
    table.text('content').nullable();
    table.timestamps(true, true);

    table.index(['vet_id']);
    table.index(['tutor_id']);
    table.index(['consultation_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('medical_records');
}
