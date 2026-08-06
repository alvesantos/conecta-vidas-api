import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('symptom_catalog', table => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.string('kind', 20).notNullable();
    table.string('code', 60).notNullable().unique();
    table.string('label', 160).notNullable();
    table.string('severity', 20).notNullable().defaultTo('normal');
    table.text('guidance').nullable();
    table.boolean('active').notNullable().defaultTo(true);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamps(true, true);
    table.index(['kind', 'active', 'sort_order'], 'symptom_catalog_context_index');
  });
  await knex.raw(`ALTER TABLE symptom_catalog ADD CONSTRAINT symptom_catalog_kind_check CHECK (kind IN ('humano', 'veterinario'))`);
  await knex.raw(`ALTER TABLE symptom_catalog ADD CONSTRAINT symptom_catalog_severity_check CHECK (severity IN ('normal', 'warning', 'emergency'))`);

  await knex.schema.createTable('quick_triages', table => {
    table.uuid('id').primary().defaultTo(knex.fn.uuid());
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('pet_id').nullable().references('id').inTable('pets').onDelete('RESTRICT');
    table.uuid('dependent_id').nullable().references('id').inTable('human_dependents').onDelete('RESTRICT');
    table.uuid('consultation_id').nullable().references('id').inTable('consultations').onDelete('RESTRICT');
    table.string('kind', 20).notNullable();
    table.string('status', 20).notNullable().defaultTo('iniciada');
    table.text('description').nullable();
    table.string('recommendation', 30).nullable();
    table.timestamp('started_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('completed_at').nullable();
    table.timestamps(true, true);
    table.index(['user_id', 'started_at'], 'quick_triages_patient_index');
  });
  await knex.raw(`
    ALTER TABLE quick_triages ADD CONSTRAINT quick_triages_context_check
    CHECK (
      (kind = 'humano' AND pet_id IS NULL)
      OR (kind = 'veterinario' AND pet_id IS NOT NULL AND dependent_id IS NULL)
    )
  `);
  await knex.raw(`ALTER TABLE quick_triages ADD CONSTRAINT quick_triages_status_check CHECK (status IN ('iniciada', 'concluida'))`);

  await knex.schema.createTable('quick_triage_symptoms', table => {
    table.uuid('triage_id').notNullable().references('id').inTable('quick_triages').onDelete('CASCADE');
    table.uuid('symptom_id').notNullable().references('id').inTable('symptom_catalog').onDelete('RESTRICT');
    table.primary(['triage_id', 'symptom_id']);
  });

  await knex('symptom_catalog').insert([
    { kind: 'humano', code: 'human_fever', label: 'Febre', severity: 'normal', sort_order: 10 },
    { kind: 'humano', code: 'human_headache', label: 'Dor de cabeça', severity: 'normal', sort_order: 20 },
    { kind: 'humano', code: 'human_cough', label: 'Tosse ou sintomas respiratórios leves', severity: 'normal', sort_order: 30 },
    { kind: 'humano', code: 'human_nausea', label: 'Náusea, vômito ou diarreia', severity: 'warning', guidance: 'Mantenha atenção à hidratação e à piora dos sintomas.', sort_order: 40 },
    { kind: 'humano', code: 'human_pain', label: 'Dor moderada', severity: 'warning', guidance: 'Dor persistente ou crescente exige avaliação presencial.', sort_order: 50 },
    { kind: 'humano', code: 'human_breathing', label: 'Falta de ar intensa', severity: 'emergency', guidance: 'Procure imediatamente um serviço de emergência presencial ou ligue para o serviço local de urgência.', sort_order: 60 },
    { kind: 'humano', code: 'human_chest_pain', label: 'Dor forte no peito', severity: 'emergency', guidance: 'Procure imediatamente um serviço de emergência presencial.', sort_order: 70 },
    { kind: 'humano', code: 'human_fainting', label: 'Desmaio, confusão ou convulsão', severity: 'emergency', guidance: 'Procure atendimento de emergência presencial imediatamente.', sort_order: 80 },
    { kind: 'veterinario', code: 'vet_appetite', label: 'Falta de apetite', severity: 'normal', sort_order: 10 },
    { kind: 'veterinario', code: 'vet_vomiting', label: 'Vômito ou diarreia', severity: 'warning', guidance: 'Observe hidratação, frequência e presença de sangue.', sort_order: 20 },
    { kind: 'veterinario', code: 'vet_skin', label: 'Coceira ou alteração na pele', severity: 'normal', sort_order: 30 },
    { kind: 'veterinario', code: 'vet_pain', label: 'Dor ou dificuldade para caminhar', severity: 'warning', guidance: 'Evite movimentação excessiva até a avaliação.', sort_order: 40 },
    { kind: 'veterinario', code: 'vet_lethargy', label: 'Prostração intensa', severity: 'warning', guidance: 'A piora rápida exige avaliação veterinária presencial.', sort_order: 50 },
    { kind: 'veterinario', code: 'vet_breathing', label: 'Dificuldade intensa para respirar', severity: 'emergency', guidance: 'Leve o animal imediatamente a um pronto atendimento veterinário presencial.', sort_order: 60 },
    { kind: 'veterinario', code: 'vet_bleeding', label: 'Sangramento intenso ou trauma grave', severity: 'emergency', guidance: 'Procure atendimento veterinário presencial imediatamente.', sort_order: 70 },
    { kind: 'veterinario', code: 'vet_seizure', label: 'Convulsão ou perda de consciência', severity: 'emergency', guidance: 'Procure atendimento veterinário presencial imediatamente.', sort_order: 80 },
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('quick_triage_symptoms');
  await knex.schema.dropTableIfExists('quick_triages');
  await knex.schema.dropTableIfExists('symptom_catalog');
}
