import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('care_queue', (table) => {
    table.uuid('assigned_by_admin_id').nullable().references('id').inTable('users').onDelete('SET NULL');
    table.index(['assigned_by_admin_id'], 'care_queue_admin_assignment_index');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('care_queue', (table) => {
    table.dropIndex(['assigned_by_admin_id'], 'care_queue_admin_assignment_index');
    table.dropColumn('assigned_by_admin_id');
  });
}
