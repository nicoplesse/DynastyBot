// The Tylo age formula lives in the frontend (frontend/src/tyloAge.ts); Node strips its types on import.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tyloAge } from '../../frontend/src/tyloAge.ts';

const today = new Date(2026, 10, 14, 12);
const age = input => tyloAge({ createdAt: '2026-11-14T12:00:00', ...input }, today);
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.1, `${actual} ≈ ${expected}`);

test('the fastest 20 clutches end close to the maximum, a long life reaches it', () => {
  near(age({ sex: 'female', hatchedAt: '2026-10-31', clutches: 20 }).years, 98.4);
  near(age({ sex: 'male', hatchedAt: '2026-11-07', clutches: 20 }).years, 58.0);
  near(age({ sex: 'female', hatchedAt: '2026-08-01', clutches: 20 }).years, 100);
  near(age({ sex: 'male', hatchedAt: '2026-08-01', clutches: 25 }).years, 60);
});

test('without clutches a Tylo stays young, however long it lives', () => {
  near(age({ sex: 'female', hatchedAt: '2026-11-13', clutches: 0 }).years, 1.6);
  assert.ok(age({ sex: 'female', hatchedAt: '2026-01-01', clutches: 0 }).years <= 12);
  assert.ok(age({ sex: 'male', hatchedAt: '2026-01-01', clutches: 0 }).years <= 15);
  assert.equal(age({ sex: 'female', hatchedAt: '2026-11-14', clutches: 0 }).stage, 'Kalb');
});

test('clutches never count faster than the fastest pace', () => {
  const rushed = age({ sex: 'female', hatchedAt: '2026-11-07', clutches: 20 });
  assert.equal(rushed.counted, 10);
  near(rushed.years, 51.6);
});

test('days count from the hatch, else from joining the register, and stop at death', () => {
  const mistral = age({ sex: 'male', createdAt: '2026-10-29T17:35:00', clutches: 3 });
  assert.equal(mistral.days, 16);
  assert.equal(mistral.fromHatch, false);
  near(mistral.years, 21.6);
  assert.equal(age({ sex: 'male', createdAt: '2026-11-03T14:48:00', diedAt: '2026-11-14', clutches: 0 }).days, 11);
  assert.equal(age({ sex: null, clutches: 3 }), null);
});
