import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { hydrateChordLibrary, getCandidateShapesForChord, selectShapeSequence } from '../public/js/chord-library.js';
import { generateProgression } from '../public/js/progression-engine.js';

async function loadLibrary() {
  const file = new URL('../public/data/chord-shapes.json', import.meta.url);
  const raw = JSON.parse(await readFile(file, 'utf8'));
  return hydrateChordLibrary(raw);
}

test('generateProgression returns four playable chords for a guitar-friendly open key', async () => {
  const library = await loadLibrary();
  const state = {
    keyLocked: true,
    keyRoot: 7,
    modePreference: 'major',
    enabledCategories: new Set(['open'])
  };

  const progression = generateProgression(state, library, () => 0);
  assert.equal(progression.warning, '');
  assert.equal(progression.chords.length, 4);
  for (const chord of progression.chords) {
    const candidates = getCandidateShapesForChord(chord, library, state.enabledCategories);
    assert.ok(candidates.length > 0);
  }
});

test('generateProgression warns when the selected category set cannot produce a progression', async () => {
  const library = await loadLibrary();
  const state = {
    keyLocked: true,
    keyRoot: 0,
    modePreference: 'major',
    enabledCategories: new Set(['sus/add'])
  };

  const progression = generateProgression(state, library, () => 0);
  assert.match(progression.warning, /No playable progression exists/);
});

test('canonical and best-fit shape selection preserve chord identity', async () => {
  const library = await loadLibrary();
  const state = {
    keyLocked: true,
    keyRoot: 7,
    modePreference: 'major',
    enabledCategories: new Set(['open', 'barre', 'seventh'])
  };

  const progression = generateProgression(state, library, () => 0.18);
  const canonical = selectShapeSequence(progression.chords, library, state.enabledCategories, 'canonical');
  const bestFit = selectShapeSequence(progression.chords, library, state.enabledCategories, 'best-fit');

  assert.equal(canonical.selected.length, progression.chords.length);
  assert.equal(bestFit.selected.length, progression.chords.length);

  canonical.selected.forEach((shape, index) => {
    assert.equal(shape.chordId, progression.chords[index].id);
  });
  bestFit.selected.forEach((shape, index) => {
    assert.equal(shape.chordId, progression.chords[index].id);
  });
});
