import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex('consultations').update({
    kind: knex.raw("CASE WHEN pet_id IS NULL THEN 'humana' ELSE 'veterinaria' END"),
  });
  await knex('prescriptions').update({
    kind: knex.raw("CASE WHEN pet_id IS NULL THEN 'humana' ELSE 'veterinaria' END"),
  });

  await knex.raw(`
    ALTER TABLE consultations
    ADD CONSTRAINT consultations_patient_context_check
    CHECK (
      (kind = 'humana' AND pet_id IS NULL)
      OR (kind = 'veterinaria' AND pet_id IS NOT NULL)
    )
  `);
  await knex.raw(`
    ALTER TABLE prescriptions
    ADD CONSTRAINT prescriptions_patient_context_check
    CHECK (
      (kind = 'humana' AND pet_id IS NULL)
      OR (kind = 'veterinaria' AND pet_id IS NOT NULL)
    )
  `);

  await knex.schema.createTable('clinical_audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('actor_user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('patient_user_id').nullable().references('id').inTable('users').onDelete('RESTRICT');
    table.string('action', 50).notNullable();
    table.string('resource_type', 50).notNullable();
    table.uuid('resource_id').nullable();
    table.string('context', 20).notNullable();
    table.jsonb('metadata').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['actor_user_id', 'created_at'], 'clinical_audit_actor_index');
    table.index(['patient_user_id', 'created_at'], 'clinical_audit_patient_index');
  });

  await knex.schema.createTable('user_consents', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.string('consent_type', 50).notNullable();
    table.string('policy_version', 30).notNullable();
    table.timestamp('granted_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('revoked_at').nullable();
    table.string('source', 30).notNullable().defaultTo('cadastro_web');
    table.index(['user_id', 'consent_type'], 'user_consents_lookup_index');
  });

  await knex.schema.alterTable('clinical_records', (table) => {
    table.timestamp('retention_review_at').nullable();
    table.timestamp('deleted_at').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('clinical_records', (table) => {
    table.dropColumn('deleted_at');
    table.dropColumn('retention_review_at');
  });
  await knex.schema.dropTableIfExists('user_consents');
  await knex.schema.dropTableIfExists('clinical_audit_logs');
  await knex.raw('ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_patient_context_check');
  await knex.raw('ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_patient_context_check');
}
