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
  assert.equal(progression.mode, 'ionian');
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
  assert.equal(progression.mode, 'ionian');
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
  assert.equal(progression.mode, 'ionian');
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

test('open chords plus sevenths makes E major feasible via B7 without changing theory rules', async () => {
  const library = await loadLibrary();
  const feasibleRoots = getFeasibleKeyRoots(
    {
      keyLocked: false,
      keyRoot: 0,
      modePreference: 'major',
      enabledShapeTypes: new Set(['open']),
      enabledFlavorOptions: new Set(['seventh'])
    },
    library
  );

  assert.ok(feasibleRoots.includes(4), 'Expected E to be available for open chords when sevenths are enabled');

  const progression = generateProgression(
    {
      keyLocked: true,
      keyRoot: 4,
      modePreference: 'major',
      enabledShapeTypes: new Set(['open']),
      enabledFlavorOptions: new Set(['seventh'])
    },
    library,
    () => 0
  );

  assert.equal(progression.warning, '');
  assert.deepEqual(
    progression.chords.map((chord) => chord.id),
    ['E:maj', 'A:maj', 'B:7', 'E:maj']
  );
});

test('open chords plus sevenths offers multiple theory-valid E major loops', async () => {
  const library = await loadLibrary();
  const state = {
    keyLocked: true,
    keyRoot: 4,
    modePreference: 'major',
    enabledShapeTypes: new Set(['open']),
    enabledFlavorOptions: new Set(['seventh'])
  };

  const progressions = Array.from({ length: 16 }, (_, index) => (
    generateProgression(state, library, () => index / 16)
  ));
  const signatures = new Set(
    progressions.map((progression) => progression.chords.map((chord) => chord.id).join('|'))
  );

  assert.ok(signatures.size > 1, 'Expected more than one E major loop for open chords plus sevenths');
  assert.ok(signatures.has('E:maj|A:maj|B:7|E:maj'));
  assert.ok(signatures.has('E:maj|B:7|A:maj|E:maj'));
});

test('representative shape and flavor combinations provide multiple loops for every feasible key', async () => {
  const library = await loadLibrary();
  const configs = [
    { modePreference: 'major', enabledShapeTypes: new Set(['open']), enabledFlavorOptions: new Set() },
    { modePreference: 'major', enabledShapeTypes: new Set(['open']), enabledFlavorOptions: new Set(['seventh']) },
    { modePreference: 'minor', enabledShapeTypes: new Set(['open']), enabledFlavorOptions: new Set() },
    { modePreference: 'minor', enabledShapeTypes: new Set(['open']), enabledFlavorOptions: new Set(['seventh']) },
    { modePreference: 'major', enabledShapeTypes: new Set(['barre']), enabledFlavorOptions: new Set() },
    { modePreference: 'minor', enabledShapeTypes: new Set(['barre']), enabledFlavorOptions: new Set() },
    { modePreference: 'major', enabledShapeTypes: new Set(['triad']), enabledFlavorOptions: new Set() },
    { modePreference: 'minor', enabledShapeTypes: new Set(['power']), enabledFlavorOptions: new Set() }
  ];

  configs.forEach((config) => {
    const roots = getFeasibleKeyRoots(
      {
        keyLocked: false,
        keyRoot: null,
        ...config
      },
      library
    );

    roots.forEach((keyRoot) => {
      const signatures = new Set(
        Array.from({ length: 32 }, (_, index) => (
          generateProgression(
            {
              keyLocked: true,
              keyRoot,
              ...config
            },
            library,
            () => index / 32
          )
        )).map((progression) => progression.chords.map((chord) => chord.id).join('|'))
      );

      assert.ok(
        signatures.size > 1,
        `Expected multiple loops for ${config.modePreference} key ${keyRoot} with ${Array.from(config.enabledShapeTypes).join('+')} and ${Array.from(config.enabledFlavorOptions).join('+') || 'no extra flavors'}`
      );
    });
  });
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
  assert.equal(rebuilt.mode, 'aeolian');
  assert.deepEqual(
    rebuilt.chords.map((chord) => chord.degree),
    progression.chords.map((chord) => chord.degree)
  );
});

test('rebuildProgression keeps the current mode when the mode preference is random', async () => {
  const library = await loadLibrary();
  const initialState = {
    keyLocked: true,
    keyRoot: 7,
    modePreference: 'dorian',
    enabledShapeTypes: new Set(['open', 'barre']),
    enabledFlavorOptions: new Set(['seventh'])
  };
  const progression = generateProgression(initialState, library, () => 0);

  const rebuilt = rebuildProgression(
    progression,
    {
      ...initialState,
      modePreference: 'random'
    },
    library
  );

  assert.equal(rebuilt.warning, '');
  assert.equal(rebuilt.mode, progression.mode);
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

test('dorian mode builds a modal progression that highlights the major IV chord', async () => {
  const library = await loadLibrary();
  const progression = generateProgression(
    {
      keyLocked: true,
      keyRoot: 2,
      modePreference: 'dorian',
      enabledShapeTypes: new Set(['open', 'barre']),
      enabledFlavorOptions: new Set()
    },
    library,
    () => 0
  );

  assert.equal(progression.warning, '');
  assert.equal(progression.mode, 'dorian');
  assert.deepEqual(
    progression.chords.map((chord) => chord.id),
    ['D:min', 'G:maj', 'C:maj', 'D:min']
  );
});

test('mixolydian mode builds a modal progression around the flat-seven cadence', async () => {
  const library = await loadLibrary();
  const progression = generateProgression(
    {
      keyLocked: true,
      keyRoot: 7,
      modePreference: 'mixolydian',
      enabledShapeTypes: new Set(['open', 'barre']),
      enabledFlavorOptions: new Set()
    },
    library,
    () => 0
  );

  assert.equal(progression.warning, '');
  assert.equal(progression.mode, 'mixolydian');
  assert.deepEqual(
    progression.chords.map((chord) => chord.id),
    ['G:maj', 'F:maj', 'C:maj', 'G:maj']
  );
});

test('blues mode prefers dominant-function blues chords in an open E loop', async () => {
  const library = await loadLibrary();
  const progression = generateProgression(
    {
      keyLocked: true,
      keyRoot: 4,
      modePreference: 'blues',
      enabledShapeTypes: new Set(['open']),
      enabledFlavorOptions: new Set()
    },
    library,
    () => 0
  );

  assert.equal(progression.warning, '');
  assert.equal(progression.mode, 'blues');
  assert.deepEqual(
    progression.chords.map((chord) => chord.id),
    ['E:7', 'A:7', 'E:7', 'B:7']
  );
});

test('locrian mode can generate a theory-correct diminished tonic loop when triads are enabled', async () => {
  const library = await loadLibrary();
  const progression = generateProgression(
    {
      keyLocked: true,
      keyRoot: 11,
      modePreference: 'locrian',
      enabledShapeTypes: new Set(['triad']),
      enabledFlavorOptions: new Set()
    },
    library,
    () => 0
  );

  assert.equal(progression.warning, '');
  assert.equal(progression.mode, 'locrian');
  assert.deepEqual(
    progression.chords.map((chord) => chord.id),
    ['B:dim', 'C:maj', 'A:min', 'B:dim']
  );
  progression.chords.forEach((chord) => {
    const candidates = getCandidateShapesForChord(chord, library, new Set(['triad']));
    assert.ok(candidates.length > 0, `Expected triad candidates for ${chord.label}`);
  });
});

test('random mode preference can generate modal progressions beyond major and minor', async () => {
  const library = await loadLibrary();
  const state = {
    keyLocked: false,
    keyRoot: null,
    modePreference: 'random',
    enabledShapeTypes: new Set(['open', 'barre', 'triad', 'power']),
    enabledFlavorOptions: new Set(['seventh'])
  };

  const generatedModes = new Set();
  for (let index = 0; index < 10; index += 1) {
    const progression = generateProgression(state, library, () => index / 9);
    generatedModes.add(progression.mode);
  }

  assert.ok(generatedModes.has('ionian'));
  assert.ok(generatedModes.has('aeolian'));
  assert.ok(
    [...generatedModes].some((mode) => !['ionian', 'aeolian'].includes(mode)),
    `Expected a non-major/minor mode, received ${[...generatedModes].join(', ')}`
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
