import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('consultations', table => {
    table.boolean('notes_visible_to_patient').notNullable().defaultTo(false);
  });

  await knex.schema.createTable('clinical_exams', table => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('professional_id').nullable().references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('consultation_id').nullable().references('id').inTable('consultations').onDelete('RESTRICT');
    table.uuid('pet_id').nullable().references('id').inTable('pets').onDelete('RESTRICT');
    table.uuid('dependent_id').nullable().references('id').inTable('human_dependents').onDelete('RESTRICT');
    table.string('kind', 20).notNullable();
    table.string('name', 160).notNullable();
    table.text('instructions').nullable();
    table.string('status', 20).notNullable().defaultTo('solicitado');
    table.string('result_url', 500).nullable();
    table.timestamp('requested_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('result_at').nullable();
    table.timestamps(true, true);
    table.index(['user_id', 'requested_at'], 'clinical_exams_patient_index');
  });
  await knex.raw(`
    ALTER TABLE clinical_exams ADD CONSTRAINT clinical_exams_context_check
    CHECK (
      (kind = 'humano' AND pet_id IS NULL)
      OR (kind = 'veterinario' AND pet_id IS NOT NULL AND dependent_id IS NULL)
    )
  `);
  await knex.raw(`
    ALTER TABLE clinical_exams ADD CONSTRAINT clinical_exams_status_check
    CHECK (status IN ('solicitado', 'agendado', 'coletado', 'disponivel', 'cancelado'))
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('clinical_exams');
  await knex.schema.alterTable('consultations', table => table.dropColumn('notes_visible_to_patient'));
}
