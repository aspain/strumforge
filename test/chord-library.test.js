import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { getCandidateShapesForChord, hydrateChordLibrary } from '../public/js/chord-library.js';

const OPEN_STRING_PITCHES = [4, 9, 2, 7, 11, 4];

const QUALITY_RULES = {
  maj: {
    required: [0, 4, 7],
    allowed: [0, 4, 7]
  },
  min: {
    required: [0, 3, 7],
    allowed: [0, 3, 7]
  },
  '5': {
    required: [0, 7],
    allowed: [0, 7]
  },
  '7': {
    required: [0, 4, 10],
    allowed: [0, 4, 7, 10]
  },
  maj7: {
    required: [0, 4, 11],
    allowed: [0, 4, 7, 11]
  },
  min7: {
    required: [0, 3, 10],
    allowed: [0, 3, 7, 10]
  },
  sus2: {
    required: [0, 2, 7],
    allowed: [0, 2, 7]
  },
  sus4: {
    required: [0, 5, 7],
    allowed: [0, 5, 7]
  },
  add9: {
    required: [0, 2, 4],
    allowed: [0, 2, 4, 7]
  }
};

async function loadLibrary() {
  const file = new URL('../public/data/chord-shapes.json', import.meta.url);
  const raw = JSON.parse(await readFile(file, 'utf8'));
  return hydrateChordLibrary(raw);
}

function uniquePitchClasses(shape) {
  return [...new Set(
    shape.frets
      .map((fret, stringIndex) => (fret >= 0 ? (OPEN_STRING_PITCHES[stringIndex] + fret) % 12 : null))
      .filter((pitchClass) => pitchClass !== null)
  )].sort((left, right) => left - right);
}

function assertShapeMatchesQuality(shape) {
  const rule = QUALITY_RULES[shape.quality];
  assert.ok(rule, `Missing validation rule for ${shape.quality}`);

  const pitchClasses = uniquePitchClasses(shape);
  const expectedRequired = rule.required.map((interval) => (shape.pitchClass + interval) % 12);
  const expectedAllowed = new Set(rule.allowed.map((interval) => (shape.pitchClass + interval) % 12));

  for (const pitchClass of expectedRequired) {
    assert.ok(
      pitchClasses.includes(pitchClass),
      `${shape.id} (${shape.label}) is missing required tone ${pitchClass}`
    );
  }

  for (const pitchClass of pitchClasses) {
    assert.ok(
      expectedAllowed.has(pitchClass),
      `${shape.id} (${shape.label}) contains unexpected tone ${pitchClass}`
    );
  }

  if (shape.categories.includes('triad')) {
    assert.equal(pitchClasses.length, 3, `${shape.id} (${shape.label}) should contain exactly three pitch classes`);
  }
}

function collectAllShapes(library) {
  const all = [...library.openShapes];
  const seenIds = new Set(all.map((shape) => shape.id));
  const enabled = new Set(['open', 'barre', 'power', 'triad']);
  const qualities = Object.keys(QUALITY_RULES);

  for (let pitchClass = 0; pitchClass < 12; pitchClass += 1) {
    for (const quality of qualities) {
      const chord = {
        id: `${pitchClass}:${quality}`,
        pitchClass,
        quality,
        label: `${pitchClass}:${quality}`
      };

      const candidates = getCandidateShapesForChord(chord, library, enabled);
      for (const shape of candidates) {
        if (seenIds.has(shape.id)) continue;
        seenIds.add(shape.id);
        all.push(shape);
      }
    }
  }

  return all;
}

test('all open and generated chord shapes match their labeled chord quality', async () => {
  const library = await loadLibrary();
  const shapes = collectAllShapes(library);

  for (const shape of shapes) {
    assert.equal(typeof shape.pitchClass, 'number', `${shape.id} is missing pitchClass metadata`);
    assert.equal(typeof shape.quality, 'string', `${shape.id} is missing quality metadata`);
    assertShapeMatchesQuality(shape);
  }
});

test('shell voicings are fully removed from the chord library', async () => {
  const library = await loadLibrary();

  const shapes = collectAllShapes(library);
  assert.ok(shapes.every((shape) => !shape.categories.includes('shell')));
});

test('triads and seventh chord shapes surface as real alternate candidates when enabled', async () => {
  const library = await loadLibrary();

  const majorCandidates = getCandidateShapesForChord(
    { id: 'C:maj', pitchClass: 0, quality: 'maj', label: 'C' },
    library,
    new Set(['open', 'triad'])
  );
  const majorLabels = new Set(majorCandidates.map((shape) => shape.label));
  assert.ok(majorLabels.has('Open C'));
  assert.ok(majorLabels.has('D-shape triad'));
  assert.ok(majorLabels.has('3-2-1 root position triad'));
  assert.ok(majorLabels.has('4-3-2 root position triad'));
  assert.ok(majorLabels.has('5-4-3 root position triad'));
  assert.ok(majorLabels.has('6-5-4 root position triad'));

  const majorSevenCandidates = getCandidateShapesForChord(
    { id: 'C:maj7', pitchClass: 0, quality: 'maj7', label: 'Cmaj7' },
    library,
    new Set(['open', 'barre'])
  );
  assert.ok(majorSevenCandidates.some((shape) => shape.label === 'Open Cmaj7'));
  assert.ok(majorSevenCandidates.some((shape) => shape.label === 'Amaj7-shape barre'));
});
