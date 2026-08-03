import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('pets', (table) => {
    table.string('size').nullable().alter();
    table.string('coat').nullable().alter();
    table.timestamp('deleted_at').nullable();
  });

  await knex.schema.createTable('clinical_records', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('pet_id').nullable().references('id').inTable('pets').onDelete('RESTRICT');
    table.string('kind', 20).notNullable();
    table.string('blood_type', 5).nullable();
    table.text('allergies').nullable();
    table.text('comorbidities').nullable();
    table.text('continuous_medications').nullable();
    table.timestamps(true, true);
    table.index(['user_id', 'kind'], 'clinical_records_user_kind_index');
    table.index(['pet_id'], 'clinical_records_pet_index');
  });

  await knex.raw(`
    ALTER TABLE clinical_records
    ADD CONSTRAINT clinical_records_kind_check
    CHECK (
      (kind = 'humano' AND pet_id IS NULL)
      OR
      (kind = 'veterinario' AND pet_id IS NOT NULL)
    )
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX clinical_records_human_user_unique
    ON clinical_records (user_id)
    WHERE kind = 'humano'
  `);
  await knex.raw(`
    CREATE UNIQUE INDEX clinical_records_vet_pet_unique
    ON clinical_records (pet_id)
    WHERE kind = 'veterinario'
  `);

  await knex.raw(`
    INSERT INTO clinical_records (user_id, pet_id, kind)
    SELECT id, NULL, 'humano'
    FROM users
    WHERE type = 'tutor'
    ON CONFLICT DO NOTHING
  `);
  await knex.raw(`
    INSERT INTO clinical_records (user_id, pet_id, kind)
    SELECT user_id, id, 'veterinario'
    FROM pets
    ON CONFLICT DO NOTHING
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('clinical_records');
  await knex.schema.alterTable('pets', (table) => {
    table.dropColumn('deleted_at');
    table.string('coat').notNullable().alter();
    table.string('size').notNullable().alter();
  });
}
