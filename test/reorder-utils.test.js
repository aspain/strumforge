import test from 'node:test';
import assert from 'node:assert/strict';

import { moveIndex, moveIndexedValues, moveItem } from '../public/js/reorder-utils.js';

test('moveItem reorders a chord list without mutating the original array', () => {
  const chords = ['C', 'G', 'Am', 'F'];

  const next = moveItem(chords, 1, 3);

  assert.deepEqual(next, ['C', 'Am', 'F', 'G']);
  assert.deepEqual(chords, ['C', 'G', 'Am', 'F']);
});

test('moveIndex keeps the active chord aligned with its moved item', () => {
  assert.equal(moveIndex(1, 1, 3), 3);
  assert.equal(moveIndex(2, 1, 3), 1);
  assert.equal(moveIndex(3, 1, 3), 2);
  assert.equal(moveIndex(0, 1, 3), 0);
});

test('moveIndexedValues keeps shape overrides attached to their original chord', () => {
  const overrides = {
    0: 2,
    2: 1
  };

  const next = moveIndexedValues(overrides, 4, 0, 2);

  assert.deepEqual(next, {
    1: 1,
    2: 2
  });
});
