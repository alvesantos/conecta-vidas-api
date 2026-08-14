import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('specialties', table => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('name', 120).notNullable();
    table.string('kind', 20).notNullable();
    table.boolean('active').notNullable().defaultTo(true);
    table.timestamps(true, true);
    table.unique(['kind', 'name']);
  });
  await knex.raw("ALTER TABLE specialties ADD CONSTRAINT specialties_kind_check CHECK (kind IN ('humana', 'veterinaria'))");

  await knex.schema.createTable('professional_specialties', table => {
    table.uuid('professional_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('specialty_id').notNullable().references('id').inTable('specialties').onDelete('CASCADE');
    table.primary(['professional_id', 'specialty_id']);
  });

  await knex.schema.createTable('professional_availability', table => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('professional_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('weekday').notNullable();
    table.time('start_time').notNullable();
    table.time('end_time').notNullable();
    table.integer('slot_minutes').notNullable().defaultTo(30);
    table.timestamps(true, true);
    table.unique(['professional_id', 'weekday', 'start_time', 'end_time']);
  });
  await knex.raw('ALTER TABLE professional_availability ADD CONSTRAINT professional_availability_weekday_check CHECK (weekday BETWEEN 0 AND 6)');
  await knex.raw('ALTER TABLE professional_availability ADD CONSTRAINT professional_availability_slot_check CHECK (slot_minutes BETWEEN 10 AND 240 AND end_time > start_time)');

  await knex.schema.alterTable('consultations', table => {
    table.uuid('specialty_id').nullable().references('id').inTable('specialties').onDelete('SET NULL');
    table.index(['specialty_id', 'date'], 'consultations_specialty_date_index');
  });
  await knex.raw("CREATE UNIQUE INDEX consultations_professional_slot_unique ON consultations (vet_id, date, time) WHERE vet_id IS NOT NULL AND status <> 'cancelada'");

  await knex.schema.createTable('consultation_email_events', table => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('consultation_id').notNullable().references('id').inTable('consultations').onDelete('CASCADE');
    table.string('type', 30).notNullable();
    table.timestamp('sent_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['consultation_id', 'type']);
  });

  await knex('specialties').insert([
    { name: 'Clínica Geral', kind: 'humana' },
    { name: 'Cardiologia', kind: 'humana' },
    { name: 'Dermatologia', kind: 'humana' },
    { name: 'Pediatria', kind: 'humana' },
    { name: 'Psiquiatria', kind: 'humana' },
    { name: 'Clínica Geral Veterinária', kind: 'veterinaria' },
    { name: 'Dermatologia Veterinária', kind: 'veterinaria' },
    { name: 'Cardiologia Veterinária', kind: 'veterinaria' },
    { name: 'Nutrição Veterinária', kind: 'veterinaria' },
    { name: 'Comportamento Animal', kind: 'veterinaria' },
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('consultation_email_events');
  await knex.raw('DROP INDEX IF EXISTS consultations_professional_slot_unique');
  await knex.schema.alterTable('consultations', table => table.dropColumn('specialty_id'));
  await knex.schema.dropTableIfExists('professional_availability');
  await knex.schema.dropTableIfExists('professional_specialties');
  await knex.schema.dropTableIfExists('specialties');
}
