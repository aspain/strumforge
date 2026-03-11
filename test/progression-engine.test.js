import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { hydrateChordLibrary, getCandidateShapesForChord, selectShapeSequence } from '../public/js/chord-library.js';
import { generateProgression, rebuildProgression, NO_PLAYABLE_LOOP_WARNING } from '../public/js/progression-engine.js';

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
  assert.equal(progression.warning, NO_PLAYABLE_LOOP_WARNING);
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

test('triad category exposes movable fourth-string triads for plain major chords', async () => {
  const library = await loadLibrary();
  const chord = {
    id: 'C:maj',
    pitchClass: 0,
    quality: 'maj',
    label: 'C'
  };

  const candidates = getCandidateShapesForChord(chord, library, new Set(['triad']));

  assert.ok(candidates.some((shape) => shape.label === 'D-shape triad'));
});

test('shell category exposes movable fourth-string seventh shells', async () => {
  const library = await loadLibrary();
  const chord = {
    id: 'C:maj7',
    pitchClass: 0,
    quality: 'maj7',
    label: 'Cmaj7'
  };

  const candidates = getCandidateShapesForChord(chord, library, new Set(['shell', 'seventh']));

  assert.ok(candidates.some((shape) => shape.label === 'Dmaj7-shape shell'));
});

test('triad-only filters can still generate a playable progression', async () => {
  const library = await loadLibrary();
  const state = {
    keyLocked: true,
    keyRoot: 0,
    modePreference: 'major',
    enabledCategories: new Set(['triad'])
  };

  const progression = generateProgression(state, library, () => 0);

  assert.equal(progression.warning, '');
  assert.equal(progression.chords.length, 4);
});

test('rebuildProgression preserves degree sequence while switching mode without randomizing', async () => {
  const library = await loadLibrary();
  const initialState = {
    keyLocked: true,
    keyRoot: 7,
    modePreference: 'major',
    enabledCategories: new Set(['open', 'barre', 'seventh'])
  };
  const progression = generateProgression(initialState, library, () => 0);

  const rebuilt = rebuildProgression(
    progression,
    {
      ...initialState,
      modePreference: 'minor'
    },
    library
  );

  assert.equal(rebuilt.warning, '');
  assert.equal(rebuilt.mode, 'minor');
  assert.equal(rebuilt.templateId, progression.templateId);
  assert.deepEqual(
    rebuilt.chords.map((chord) => chord.degree),
    progression.chords.map((chord) => chord.degree)
  );
});

test('rebuildProgression transposes the current progression when the locked key root changes', async () => {
  const library = await loadLibrary();
  const initialState = {
    keyLocked: true,
    keyRoot: 7,
    modePreference: 'major',
    enabledCategories: new Set(['open', 'barre', 'seventh'])
  };
  const progression = generateProgression(initialState, library, () => 0);

  const rebuilt = rebuildProgression(
    progression,
    {
      ...initialState,
      keyRoot: 0
    },
    library
  );

  assert.equal(rebuilt.warning, '');
  assert.equal(rebuilt.keyRoot, 0);
  assert.deepEqual(
    rebuilt.chords.map((chord) => chord.degree),
    progression.chords.map((chord) => chord.degree)
  );
  assert.notDeepEqual(
    rebuilt.chords.map((chord) => chord.label),
    progression.chords.map((chord) => chord.label)
  );
});

test('rebuildProgression with reharmonize upgrades eligible chords to sevenths when enabled', async () => {
  const library = await loadLibrary();
  const baseState = {
    keyLocked: true,
    keyRoot: 7,
    modePreference: 'major',
    enabledCategories: new Set(['open', 'barre'])
  };
  const progression = generateProgression(baseState, library, () => 0);

  const rebuilt = rebuildProgression(
    progression,
    {
      ...baseState,
      enabledCategories: new Set(['open', 'barre', 'seventh']),
      rebuildStrategy: 'reharmonize'
    },
    library
  );

  assert.equal(rebuilt.warning, '');
  assert.equal(rebuilt.templateId, progression.templateId);
  assert.deepEqual(
    rebuilt.chords.map((chord) => chord.degree),
    progression.chords.map((chord) => chord.degree)
  );
  assert.ok(
    rebuilt.chords.some((chord) => ['7', 'maj7', 'min7'].includes(chord.quality)),
    'Expected at least one seventh-quality chord after reharmonizing'
  );
});

test('rebuildProgression with reharmonize upgrades eligible major chords to sus/add when enabled', async () => {
  const library = await loadLibrary();
  const baseState = {
    keyLocked: true,
    keyRoot: 7,
    modePreference: 'major',
    enabledCategories: new Set(['open', 'barre'])
  };
  const progression = generateProgression(baseState, library, () => 0);

  const rebuilt = rebuildProgression(
    progression,
    {
      ...baseState,
      enabledCategories: new Set(['open', 'barre', 'sus/add']),
      rebuildStrategy: 'reharmonize'
    },
    library
  );

  assert.equal(rebuilt.warning, '');
  assert.equal(rebuilt.templateId, progression.templateId);
  assert.deepEqual(
    rebuilt.chords.map((chord) => chord.degree),
    progression.chords.map((chord) => chord.degree)
  );
  assert.ok(
    rebuilt.chords.some((chord) => ['sus2', 'sus4', 'add9'].includes(chord.quality)),
    'Expected at least one sus/add chord after reharmonizing'
  );
});
