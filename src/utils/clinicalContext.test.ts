import test from 'node:test';
import assert from 'node:assert/strict';
import { contextFromPetId, isClinicalContextCompatible } from './clinicalContext';

test('consulta sem pet pertence exclusivamente ao contexto humano', () => {
  assert.equal(contextFromPetId(null), 'humana');
  assert.equal(isClinicalContextCompatible('humana', null), true);
  assert.equal(isClinicalContextCompatible('veterinaria', null), false);
});

test('consulta com pet pertence exclusivamente ao contexto veterinário', () => {
  assert.equal(contextFromPetId('pet-id'), 'veterinaria');
  assert.equal(isClinicalContextCompatible('veterinaria', 'pet-id'), true);
  assert.equal(isClinicalContextCompatible('humana', 'pet-id'), false);
});
