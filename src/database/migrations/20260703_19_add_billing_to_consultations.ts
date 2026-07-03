import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('consultations', (table) => {
    // Registra, no momento do agendamento, se a consulta consumiu uma cota
    // gratuita do plano. Preserva o histórico mesmo que o plano mude depois.
    table.boolean('is_free').notNullable().defaultTo(false);
    // Valor efetivamente cobrado (0 quando gratuita). Nulo = ainda não cobrado.
    table.decimal('charged_value', 10, 2).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('consultations', (table) => {
    table.dropColumn('is_free');
    table.dropColumn('charged_value');
  });
}
