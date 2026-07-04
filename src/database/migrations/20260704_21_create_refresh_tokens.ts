import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('refresh_tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    // Guardamos apenas o hash (SHA-256) do token opaco — nunca o valor cru,
    // para que um vazamento do banco não permita reutilizar a sessão.
    table.string('token_hash', 64).notNullable().unique();
    table.timestamp('expires_at').notNullable();
    // Preenchido no logout ou na rotação (o token antigo é revogado ao emitir um novo).
    table.timestamp('revoked_at').nullable();
    table.timestamps(true, true);

    table.index(['user_id']);
    table.index(['expires_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('refresh_tokens');
}
