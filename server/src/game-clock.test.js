import test from 'node:test';
import assert from 'node:assert/strict';
import { gameHour, realTimeOf } from '../../shared/game-clock.mjs';

const at = (hour, minute, second = 0) => new Date(2026, 9, 31, hour, minute, second);

test('one real hour is one game day starting at 06:00', () => {
  assert.equal(gameHour(at(1, 0)), 6, 'full hour = morning');
  assert.equal(gameHour(at(1, 15)), 12, 'quarter past = noon');
  assert.equal(gameHour(at(1, 30)), 18, 'half past = evening');
  assert.equal(gameHour(at(1, 45)), 0, 'quarter to = midnight');
  assert.equal(gameHour(at(1, 52, 30)), 3);
  assert.equal(gameHour(at(14, 1)), 6.4, 'one real minute = 24 game minutes');
});

test('the real time of the next sunset and sunrise', () => {
  assert.deepEqual(realTimeOf(18.5, at(1, 0)), at(1, 31, 15), 'sunset at 18:30 game');
  assert.deepEqual(realTimeOf(6, at(1, 40)), at(2, 0), 'the next game morning is the next full hour');
});
