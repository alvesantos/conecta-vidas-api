import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('consultations', table => {
    table.string('care_mode', 20).notNullable().defaultTo('especialista');
  });
  await knex.raw(`
    ALTER TABLE consultations ADD CONSTRAINT consultations_care_mode_check
    CHECK (care_mode IN ('pronto', 'especialista'))
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_care_mode_check');
  await knex.schema.alterTable('consultations', table => table.dropColumn('care_mode'));
}
