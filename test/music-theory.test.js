import test from 'node:test';
import assert from 'node:assert/strict';

import { buildChordDefinition, getKeyTonicName, getScaleNoteName } from '../public/js/music-theory.js';

test('major keys use theory-correct tonic spellings for their scale degrees', () => {
  assert.equal(getKeyTonicName('ionian', 4), 'E');
  assert.equal(getScaleNoteName('ionian', 4, 6), 'C#');
  assert.equal(buildChordDefinition(4, 'ionian', 6).label, 'C#m');
});

test('minor keys prefer conventional tonic spellings', () => {
  assert.equal(getKeyTonicName('aeolian', 1), 'C#');
  assert.equal(getScaleNoteName('aeolian', 1, 6), 'A');
  assert.equal(buildChordDefinition(1, 'aeolian', 4).label, 'F#m');
});

test('sharp keys spell leading tones correctly instead of flattening them', () => {
  const leadingToneChord = buildChordDefinition(6, 'ionian', 7);

  assert.equal(leadingToneChord.noteName, 'E#');
  assert.equal(leadingToneChord.label, 'E#dim');
  assert.equal(leadingToneChord.id, 'E#:dim');
});

test('modal tonic spelling selection favors readable keys for bright modes', () => {
  assert.equal(getKeyTonicName('lydian', 1), 'Db');
  assert.equal(getScaleNoteName('lydian', 1, 4), 'G');
  assert.equal(buildChordDefinition(1, 'lydian', 2).label, 'Eb');
});

test('modal tonic spelling selection favors readable keys for dark modes', () => {
  assert.equal(getKeyTonicName('dorian', 1), 'C#');
  assert.equal(getScaleNoteName('locrian', 5, 5), 'Cb');
  assert.equal(buildChordDefinition(11, 'locrian', 1).label, 'Bdim');
});

test('blues mode exposes dominant tonic and subdominant chord spellings', () => {
  assert.equal(getKeyTonicName('blues', 4), 'E');
  assert.equal(buildChordDefinition(4, 'blues', 1).label, 'E7');
  assert.equal(buildChordDefinition(4, 'blues', 4).label, 'A7');
});
