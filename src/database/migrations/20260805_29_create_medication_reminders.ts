import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('medication_reminders', table => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('pet_id').nullable().references('id').inTable('pets').onDelete('RESTRICT');
    table.uuid('dependent_id').nullable().references('id').inTable('human_dependents').onDelete('RESTRICT');
    table.string('kind', 20).notNullable();
    table.string('name', 120).notNullable();
    table.string('dosage', 120).nullable();
    table.text('instructions').nullable();
    table.time('time').notNullable();
    table.boolean('active').notNullable().defaultTo(true);
    table.timestamp('deleted_at').nullable();
    table.timestamps(true, true);
    table.index(['user_id', 'deleted_at'], 'medication_reminders_owner_index');
    table.index(['user_id', 'time'], 'medication_reminders_time_index');
  });
  await knex.raw(`
    ALTER TABLE medication_reminders
    ADD CONSTRAINT medication_reminders_context_check
    CHECK (
      (kind = 'humano' AND pet_id IS NULL)
      OR (kind = 'veterinario' AND pet_id IS NOT NULL AND dependent_id IS NULL)
    )
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('medication_reminders');
}
