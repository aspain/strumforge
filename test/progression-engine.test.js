import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { hydrateChordLibrary, getCandidateShapesForChord, selectShapeSequence } from '../public/js/chord-library.js';
import {
  generateDistinctProgression,
  generateProgression,
  getFeasibleKeyRoots,
  rebuildProgression,
  LOCKED_KEY_CHORD_SHAPES_WARNING
} from '../public/js/progression-engine.js';

async function loadLibrary() {
  const file = new URL('../public/data/chord-shapes.json', import.meta.url);
  const raw = JSON.parse(await readFile(file, 'utf8'));
  return hydrateChordLibrary(raw);
}

test('generateProgression returns four playable chords when only open chords are enabled and key is unlocked', async () => {
  const library = await loadLibrary();
  const state = {
    keyLocked: false,
    keyRoot: 0,
    modePreference: 'major',
    enabledShapeTypes: new Set(['open']),
    enabledFlavorOptions: new Set()
  };

  const progression = generateProgression(state, library, () => 0);
  assert.equal(progression.warning, '');
  assert.equal(progression.chords.length, 4);
  for (const chord of progression.chords) {
    const candidates = getCandidateShapesForChord(chord, library, state.enabledShapeTypes);
    assert.ok(candidates.length > 0);
  }
});

test('generateProgression treats a null keyRoot as random when keyLocked is omitted', async () => {
  const library = await loadLibrary();
  const progression = generateProgression(
    {
      keyRoot: null,
      modePreference: 'major',
      enabledShapeTypes: new Set(['open']),
      enabledFlavorOptions: new Set()
    },
    library,
    () => 0
  );

  assert.equal(progression.warning, '');
  assert.equal(progression.chords.length, 4);
});

test('generateProgression warns when a locked key does not fit the selected chord shapes', async () => {
  const library = await loadLibrary();
  const state = {
    keyLocked: true,
    keyRoot: 1,
    modePreference: 'major',
    enabledShapeTypes: new Set(['open']),
    enabledFlavorOptions: new Set()
  };

  const progression = generateProgression(state, library, () => 0);
  assert.equal(progression.warning, LOCKED_KEY_CHORD_SHAPES_WARNING);
});

test('generateProgression can build a C major open-chord loop when the key is locked to C', async () => {
  const library = await loadLibrary();
  const progression = generateProgression(
    {
      keyLocked: true,
      keyRoot: 0,
      modePreference: 'major',
      enabledShapeTypes: new Set(['open']),
      enabledFlavorOptions: new Set()
    },
    library,
    () => 0.999
  );

  assert.equal(progression.warning, '');
  assert.equal(progression.keyRoot, 0);
  assert.equal(progression.mode, 'major');
  assert.equal(progression.chords.length, 4);
  for (const chord of progression.chords) {
    const candidates = getCandidateShapesForChord(chord, library, new Set(['open']));
    assert.ok(candidates.length > 0, `Expected at least one open-chord shape for ${chord.label}`);
  }
});

test('generateProgression treats a numeric keyRoot as fixed when keyLocked is omitted', async () => {
  const library = await loadLibrary();
  const progression = generateProgression(
    {
      keyRoot: 0,
      modePreference: 'major',
      enabledShapeTypes: new Set(['open']),
      enabledFlavorOptions: new Set()
    },
    library,
    () => 0.999
  );

  assert.equal(progression.warning, '');
  assert.equal(progression.keyRoot, 0);
  assert.equal(progression.mode, 'major');
});

test('generateProgression spells diatonic chords according to the locked key signature', async () => {
  const library = await loadLibrary();
  const progression = generateProgression(
    {
      keyLocked: true,
      keyRoot: 4,
      modePreference: 'major',
      enabledShapeTypes: new Set(['open', 'barre']),
      enabledFlavorOptions: new Set()
    },
    library,
    () => 0
  );

  assert.equal(progression.warning, '');
  assert.equal(progression.keyRoot, 4);
  assert.equal(progression.mode, 'major');
  assert.deepEqual(
    progression.chords.map((chord) => chord.label),
    ['E', 'B', 'C#m', 'A']
  );
  assert.deepEqual(
    progression.chords.map((chord) => chord.id),
    ['E:maj', 'B:maj', 'C#:min', 'A:maj']
  );
});

test('generateProgression offers multiple open-chord major loops when the key is locked to C', async () => {
  const library = await loadLibrary();
  const progressions = [0, 0.82, 0.9, 0.97, 0.999].map((rngValue) => {
    const progression = generateProgression(
      {
        keyLocked: true,
        keyRoot: 0,
        modePreference: 'major',
        enabledShapeTypes: new Set(['open']),
        enabledFlavorOptions: new Set()
      },
      library,
      () => rngValue
    );
    assert.equal(progression.warning, '');
    return progression;
  });
  const degreeSequences = new Set(
    progressions.map((progression) => progression.chords.map((chord) => chord.degree).join('-'))
  );

  assert.ok(degreeSequences.size > 1, 'Expected more than one open-chord loop for locked C major');
});

test('generateDistinctProgression avoids returning the current exact loop when alternatives exist', async () => {
  const library = await loadLibrary();
  const state = {
    keyLocked: true,
    keyRoot: 0,
    modePreference: 'major',
    enabledShapeTypes: new Set(['open']),
    enabledFlavorOptions: new Set()
  };
  const current = generateProgression(state, library, () => 0);
  const next = generateDistinctProgression(state, library, current, () => 0);

  assert.equal(next.warning, '');
  assert.notDeepEqual(
    {
      keyRoot: next.keyRoot,
      mode: next.mode,
      chordIds: next.chords.map((chord) => chord.id)
    },
    {
      keyRoot: current.keyRoot,
      mode: current.mode,
      chordIds: current.chords.map((chord) => chord.id)
    }
  );
});

test('getFeasibleKeyRoots reflects open-chord-friendly keys for the current settings', async () => {
  const library = await loadLibrary();
  const feasibleRoots = getFeasibleKeyRoots(
    {
      keyLocked: false,
      keyRoot: 0,
      modePreference: 'auto',
      enabledShapeTypes: new Set(['open']),
      enabledFlavorOptions: new Set()
    },
    library
  );

  assert.ok(feasibleRoots.includes(0), 'Expected C to be available for open chords');
  assert.ok(!feasibleRoots.includes(10), 'Expected Bb to be unavailable for open chords');
});

test('open and barre chord shapes generate playable progressions across all keys and modes', async () => {
  const library = await loadLibrary();

  for (let keyRoot = 0; keyRoot < 12; keyRoot += 1) {
    for (const modePreference of ['major', 'minor']) {
      const progression = generateProgression(
        {
          keyLocked: true,
          keyRoot,
          modePreference,
          enabledShapeTypes: new Set(['open', 'barre']),
          enabledFlavorOptions: new Set()
        },
        library,
        () => 0
      );

      assert.equal(progression.warning, '', `Expected playable progression for ${keyRoot} ${modePreference}`);
      assert.equal(progression.chords.length, 4);
    }
  }
});

test('canonical and best-fit shape selection preserve chord identity', async () => {
  const library = await loadLibrary();
  const state = {
    keyLocked: true,
    keyRoot: 7,
    modePreference: 'major',
    enabledShapeTypes: new Set(['open', 'barre']),
    enabledFlavorOptions: new Set(['seventh'])
  };

  const progression = generateProgression(state, library, () => 0.18);
  const canonical = selectShapeSequence(progression.chords, library, state.enabledShapeTypes, 'canonical');
  const bestFit = selectShapeSequence(progression.chords, library, state.enabledShapeTypes, 'best-fit');

  assert.equal(canonical.selected.length, progression.chords.length);
  assert.equal(bestFit.selected.length, progression.chords.length);

  canonical.selected.forEach((shape, index) => {
    assert.equal(shape.chordId, progression.chords[index].id);
  });
  bestFit.selected.forEach((shape, index) => {
    assert.equal(shape.chordId, progression.chords[index].id);
  });
});

test('triad category exposes movable triads across multiple string sets for plain major chords', async () => {
  const library = await loadLibrary();
  const chord = {
    id: 'C:maj',
    pitchClass: 0,
    quality: 'maj',
    label: 'C'
  };

  const candidates = getCandidateShapesForChord(chord, library, new Set(['triad']));

  assert.ok(candidates.some((shape) => shape.label === 'D-shape triad'));
  assert.ok(candidates.some((shape) => shape.label === '3-2-1 root position triad'));
  assert.ok(candidates.some((shape) => shape.label === '4-3-2 root position triad'));
  assert.ok(candidates.some((shape) => shape.label === '5-4-3 root position triad'));
  assert.ok(candidates.some((shape) => shape.label === '6-5-4 root position triad'));
});

test('triad-only filters can still generate a playable progression', async () => {
  const library = await loadLibrary();
  const state = {
    keyLocked: true,
    keyRoot: 0,
    modePreference: 'major',
    enabledShapeTypes: new Set(['triad']),
    enabledFlavorOptions: new Set()
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
    enabledShapeTypes: new Set(['open', 'barre']),
    enabledFlavorOptions: new Set(['seventh'])
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
    enabledShapeTypes: new Set(['open', 'barre']),
    enabledFlavorOptions: new Set(['seventh'])
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
    enabledShapeTypes: new Set(['open', 'barre']),
    enabledFlavorOptions: new Set()
  };
  const progression = generateProgression(baseState, library, () => 0);

  const rebuilt = rebuildProgression(
    progression,
    {
      ...baseState,
      enabledFlavorOptions: new Set(['seventh']),
      rebuildStrategy: 'reharmonize'
    },
    library
  );

  assert.equal(rebuilt.warning, '');
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
    enabledShapeTypes: new Set(['open', 'barre']),
    enabledFlavorOptions: new Set()
  };
  const progression = generateProgression(baseState, library, () => 0);

  const rebuilt = rebuildProgression(
    progression,
    {
      ...baseState,
      enabledFlavorOptions: new Set(['sus/add']),
      rebuildStrategy: 'reharmonize'
    },
    library
  );

  assert.equal(rebuilt.warning, '');
  assert.deepEqual(
    rebuilt.chords.map((chord) => chord.degree),
    progression.chords.map((chord) => chord.degree)
  );
  assert.ok(
    rebuilt.chords.some((chord) => ['sus2', 'sus4', 'add9'].includes(chord.quality)),
    'Expected at least one sus/add chord after reharmonizing'
  );
});

test('power chord shapes allow 5-chord qualities and playable power shapes', async () => {
  const library = await loadLibrary();
  const state = {
    keyLocked: true,
    keyRoot: 0,
    modePreference: 'major',
    enabledShapeTypes: new Set(['power']),
    enabledFlavorOptions: new Set()
  };

  const progression = generateProgression(state, library, () => 0.999);

  assert.equal(progression.warning, '');
  assert.ok(
    progression.chords.some((chord) => chord.quality === '5'),
    'Expected at least one power-chord quality when power shapes are enabled'
  );

  for (const chord of progression.chords.filter((item) => item.quality === '5')) {
    const candidates = getCandidateShapesForChord(chord, library, state.enabledShapeTypes);
    assert.ok(candidates.length > 0);
    assert.ok(candidates.every((shape) => shape.categories.includes('power')));
  }
});

test('generateProgression does not always collapse to power-chord qualities when power shapes are enabled', async () => {
  const library = await loadLibrary();
  const state = {
    keyLocked: false,
    keyRoot: 0,
    modePreference: 'auto',
    enabledShapeTypes: new Set(['open', 'barre', 'triad', 'power']),
    enabledFlavorOptions: new Set(['seventh'])
  };

  const qualities = new Set();
  for (let index = 0; index < 25; index += 1) {
    const progression = generateProgression(state, library);
    progression.chords.forEach((chord) => qualities.add(chord.quality));
  }

  assert.ok(qualities.has('5'), 'Expected power chords to remain available');
  assert.ok(
    qualities.has('maj') || qualities.has('min') || qualities.has('7') || qualities.has('maj7') || qualities.has('min7'),
    'Expected non-power chord qualities to appear across repeated generations'
  );
});
