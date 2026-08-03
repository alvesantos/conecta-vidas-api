import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex('users')
    .whereNotNull('cpf')
    .update({
      cpf: knex.raw("regexp_replace(cpf, '[^0-9]', '', 'g')"),
    });

  await knex.raw(`
    CREATE UNIQUE INDEX users_cpf_digits_unique
    ON users ((regexp_replace(cpf, '[^0-9]', '', 'g')))
    WHERE cpf IS NOT NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS users_cpf_digits_unique');
}
