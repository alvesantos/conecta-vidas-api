import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_type_check');
  await knex.raw(`
    ALTER TABLE users
    ADD CONSTRAINT users_type_check
    CHECK (type IN ('tutor', 'admin', 'veterinario', 'medico'))
  `);

  await knex.schema.alterTable('users', (table) => {
    table.string('crm', 20).nullable();
    table.string('status', 20).notNullable().defaultTo('active');
    table.text('status_reason').nullable();
    table.uuid('reviewed_by').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('reviewed_at').nullable();
    table.index(['type', 'status'], 'users_type_status_index');
  });

  await knex.raw(`
    ALTER TABLE users
    ADD CONSTRAINT users_status_check
    CHECK (status IN ('pending', 'active', 'rejected', 'suspended'))
  `);

  await knex.schema.alterTable('consultations', (table) => {
    table.string('kind', 20).notNullable().defaultTo('veterinaria');
    table.index(['kind', 'vet_id'], 'consultations_kind_professional_index');
  });
  await knex.raw(`
    ALTER TABLE consultations
    ADD CONSTRAINT consultations_kind_check
    CHECK (kind IN ('humana', 'veterinaria'))
  `);

  await knex.schema.alterTable('prescriptions', (table) => {
    table.string('kind', 20).notNullable().defaultTo('veterinaria');
    table.index(['kind', 'vet_id'], 'prescriptions_kind_professional_index');
  });
  await knex.raw(`
    ALTER TABLE prescriptions
    ADD CONSTRAINT prescriptions_kind_check
    CHECK (kind IN ('humana', 'veterinaria'))
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_kind_check');
  await knex.schema.alterTable('prescriptions', (table) => {
    table.dropIndex(['kind', 'vet_id'], 'prescriptions_kind_professional_index');
    table.dropColumn('kind');
  });

  await knex.raw('ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_kind_check');
  await knex.schema.alterTable('consultations', (table) => {
    table.dropIndex(['kind', 'vet_id'], 'consultations_kind_professional_index');
    table.dropColumn('kind');
  });

  await knex.raw('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check');
  await knex.schema.alterTable('users', (table) => {
    table.dropIndex(['type', 'status'], 'users_type_status_index');
    table.dropColumn('reviewed_by');
    table.dropColumn('reviewed_at');
    table.dropColumn('status_reason');
    table.dropColumn('status');
    table.dropColumn('crm');
  });

  await knex.raw('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_type_check');
  await knex.raw(`
    ALTER TABLE users
    ADD CONSTRAINT users_type_check
    CHECK (type IN ('tutor', 'admin', 'veterinario'))
  `);
}
