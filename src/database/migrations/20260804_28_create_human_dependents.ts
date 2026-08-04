import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('human_dependents', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.string('name').notNullable();
    table.string('cpf', 11).nullable();
    table.date('birth_date').notNullable();
    table.string('biological_sex', 20).notNullable();
    table.string('relationship', 40).notNullable();
    table.string('phone', 20).nullable();
    table.boolean('legal_guardian_confirmed').notNullable().defaultTo(false);
    table.timestamp('deleted_at').nullable();
    table.timestamps(true, true);
    table.index(['user_id', 'deleted_at'], 'human_dependents_owner_index');
  });
  await knex.raw(`
    CREATE UNIQUE INDEX human_dependents_cpf_unique
    ON human_dependents (cpf)
    WHERE cpf IS NOT NULL AND deleted_at IS NULL
  `);

  await knex.raw('ALTER TABLE clinical_records DROP CONSTRAINT IF EXISTS clinical_records_kind_check');
  await knex.raw('DROP INDEX IF EXISTS clinical_records_human_user_unique');
  await knex.schema.alterTable('clinical_records', (table) => {
    table.uuid('dependent_id').nullable().references('id').inTable('human_dependents').onDelete('RESTRICT');
    table.index(['dependent_id'], 'clinical_records_dependent_index');
  });
  await knex.raw(`
    ALTER TABLE clinical_records
    ADD CONSTRAINT clinical_records_kind_check
    CHECK (
      (kind = 'humano' AND pet_id IS NULL)
      OR (kind = 'veterinario' AND pet_id IS NOT NULL AND dependent_id IS NULL)
    )
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX clinical_records_human_user_unique
    ON clinical_records (user_id)
    WHERE kind = 'humano' AND dependent_id IS NULL
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX clinical_records_human_dependent_unique
    ON clinical_records (dependent_id)
    WHERE kind = 'humano' AND dependent_id IS NOT NULL
  `);

  await knex.raw('ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_patient_context_check');
  await knex.schema.alterTable('consultations', (table) => {
    table.uuid('dependent_id').nullable().references('id').inTable('human_dependents').onDelete('RESTRICT');
    table.index(['dependent_id'], 'consultations_dependent_index');
  });
  await knex.raw(`
    ALTER TABLE consultations
    ADD CONSTRAINT consultations_patient_context_check
    CHECK (
      (kind = 'humana' AND pet_id IS NULL)
      OR (kind = 'veterinaria' AND pet_id IS NOT NULL AND dependent_id IS NULL)
    )
  `);

  await knex.raw('ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_patient_context_check');
  await knex.schema.alterTable('prescriptions', (table) => {
    table.uuid('dependent_id').nullable().references('id').inTable('human_dependents').onDelete('RESTRICT');
    table.index(['dependent_id'], 'prescriptions_dependent_index');
  });
  await knex.raw(`
    ALTER TABLE prescriptions
    ADD CONSTRAINT prescriptions_patient_context_check
    CHECK (
      (kind = 'humana' AND pet_id IS NULL)
      OR (kind = 'veterinaria' AND pet_id IS NOT NULL AND dependent_id IS NULL)
    )
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_patient_context_check');
  await knex.schema.alterTable('prescriptions', table => table.dropColumn('dependent_id'));
  await knex.raw(`
    ALTER TABLE prescriptions ADD CONSTRAINT prescriptions_patient_context_check
    CHECK ((kind = 'humana' AND pet_id IS NULL) OR (kind = 'veterinaria' AND pet_id IS NOT NULL))
  `);
  await knex.raw('ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_patient_context_check');
  await knex.schema.alterTable('consultations', table => table.dropColumn('dependent_id'));
  await knex.raw(`
    ALTER TABLE consultations ADD CONSTRAINT consultations_patient_context_check
    CHECK ((kind = 'humana' AND pet_id IS NULL) OR (kind = 'veterinaria' AND pet_id IS NOT NULL))
  `);
  await knex.raw('ALTER TABLE clinical_records DROP CONSTRAINT IF EXISTS clinical_records_kind_check');
  await knex.raw('DROP INDEX IF EXISTS clinical_records_human_dependent_unique');
  await knex.raw('DROP INDEX IF EXISTS clinical_records_human_user_unique');
  await knex.schema.alterTable('clinical_records', table => table.dropColumn('dependent_id'));
  await knex.raw(`
    ALTER TABLE clinical_records ADD CONSTRAINT clinical_records_kind_check
    CHECK ((kind = 'humano' AND pet_id IS NULL) OR (kind = 'veterinario' AND pet_id IS NOT NULL))
  `);
  await knex.raw(`CREATE UNIQUE INDEX clinical_records_human_user_unique ON clinical_records (user_id) WHERE kind = 'humano'`);
  await knex.schema.dropTableIfExists('human_dependents');
}
