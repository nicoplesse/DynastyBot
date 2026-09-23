import test from 'node:test';
import assert from 'node:assert/strict';
import { combineStats } from './stats-model.js';

const reference = {
  sourceTitle: 'Example source', sourceUrl: 'https://example.org/stats', sourceType: 'reference',
  sourceUpdatedAt: '2026-09-17',
  curves: {
    'Core.CombatWeight': [100, 200, 300, 400, 500],
    'Core.SprintingSpeedMultiplier': [1, 1, 1, 1, 1],
    'Core.ThirstDepletionRate': [0.04, 0.06, 0.08, 0.1, 0.12],
    BiteDamage: [10, 20, 30, 40, 50],
  },
};

const change = (text, current = null, previous = null) => ({ text, current, previous });

test('keeps all reference curves and applies explicit adult Dynasty values', () => {
  const result = combineStats({ combatWeight: 600, changes: [change('Bite damage increased to 70 from 50', '70', '50')] }, reference);
  assert.equal(result.curves.length, 4);
  assert.deepEqual(result.curves.find(row => row.key === 'BiteDamage').effectiveValues, [10, 20, 30, 40, 70]);
  assert.equal(result.curves.find(row => row.key === 'Core.CombatWeight').effectiveValues[4], 600);
});

test('percentage adjustments are multiplicative, including decimals', () => {
  const result = combineStats({ combatWeight: null, changes: [change('Sprint speed increased by 4.65%')] }, reference);
  assert.equal(result.curves.find(row => row.key === 'Core.SprintingSpeedMultiplier').effectiveValues[4], 1.0465);
});

test('hatchling-only changes leave adult values intact', () => {
  const result = combineStats({ combatWeight: null, changes: [change('Hatchling thirst depletion rate reduced to 0.01 from 0.04', '0.01', '0.04')] }, reference);
  assert.deepEqual(result.curves.find(row => row.key === 'Core.ThirstDepletionRate').effectiveValues, [0.01, 0.06, 0.08, 0.1, 0.12]);
});

test('mismatched source values and unknown changes remain visible', () => {
  const result = combineStats({ combatWeight: null, changes: [change('Bite damage increased to 70 from 45', '70', '45'), change('New roar effect added')] }, reference);
  assert.equal(result.warnings.length, 1);
  assert.deepEqual(result.unmappedChanges, ['New roar effect added']);
});
