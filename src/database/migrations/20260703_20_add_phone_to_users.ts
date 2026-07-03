import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    // Telefone/WhatsApp do responsável. Usado no cadastro via bot (2.4) e
    // no envio do link da sala 30 min antes da consulta (3.8).
    table.string('phone', 20).nullable();
    table.index(['phone']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.dropIndex(['phone']);
    table.dropColumn('phone');
  });
}
