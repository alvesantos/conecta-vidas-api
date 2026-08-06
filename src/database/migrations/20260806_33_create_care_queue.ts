import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('care_queue', table => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('consultation_id').notNullable().unique().references('id').inTable('consultations').onDelete('RESTRICT');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('pet_id').nullable().references('id').inTable('pets').onDelete('RESTRICT');
    table.uuid('dependent_id').nullable().references('id').inTable('human_dependents').onDelete('RESTRICT');
    table.string('kind', 20).notNullable();
    table.string('status', 20).notNullable().defaultTo('aguardando');
    table.integer('priority').notNullable().defaultTo(0);
    table.timestamp('joined_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('called_at').nullable();
    table.timestamp('left_at').nullable();
    table.timestamps(true, true);
    table.index(['kind', 'status', 'priority', 'joined_at'], 'care_queue_order_index');
    table.index(['user_id', 'status'], 'care_queue_patient_index');
  });
  await knex.raw(`
    ALTER TABLE care_queue ADD CONSTRAINT care_queue_context_check
    CHECK (
      (kind = 'humano' AND pet_id IS NULL)
      OR (kind = 'veterinario' AND pet_id IS NOT NULL AND dependent_id IS NULL)
    )
  `);
  await knex.raw(`
    ALTER TABLE care_queue ADD CONSTRAINT care_queue_status_check
    CHECK (status IN ('aguardando', 'chamado', 'em_atendimento', 'concluido', 'saiu'))
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('care_queue');
}
