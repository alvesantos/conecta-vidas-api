import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.date('birth_date').nullable();
    table.string('biological_sex', 20).nullable();
  });

  await knex.raw(`
    ALTER TABLE users
    ADD CONSTRAINT users_biological_sex_check
    CHECK (biological_sex IS NULL OR biological_sex IN ('feminino', 'masculino', 'intersexo', 'nao_informado'))
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_biological_sex_check');
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('birth_date');
    table.dropColumn('biological_sex');
  });
}
