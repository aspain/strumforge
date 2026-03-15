import { buildChordId, normalizePitchClass } from './music-theory.js';

const OPEN_STRING_PITCHES = [4, 9, 2, 7, 11, 4];
const OPEN_STRING_MIDIS = [40, 45, 50, 55, 59, 64];
const SHAPE_TYPE_CATEGORIES = new Set(['open', 'barre', 'triad', 'power']);
const TRIAD_STRING_GROUPS = [
  { id: '321', stringIndexes: [3, 4, 5], label: '3-2-1', canonicalRank: 29, difficulty: 1, positionBias: 0.05 },
  { id: '432', stringIndexes: [2, 3, 4], label: '4-3-2', canonicalRank: 30, difficulty: 2, positionBias: 0.1 },
  { id: '543', stringIndexes: [1, 2, 3], label: '5-4-3', canonicalRank: 31, difficulty: 2, positionBias: 0.15 },
  { id: '654', stringIndexes: [0, 1, 2], label: '6-5-4', canonicalRank: 32, difficulty: 3, positionBias: 0.2 }
];
const TRIAD_QUALITY_INTERVALS = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7]
};
const TRIAD_INVERSION_INTERVALS = [
  { id: 'root-position', label: 'root position', buildIntervals: (intervals) => [intervals[0], intervals[1], intervals[2]] },
  { id: '1st-inversion', label: '1st inversion', buildIntervals: (intervals) => [intervals[1], intervals[2], intervals[0] + 12] },
  { id: '2nd-inversion', label: '2nd inversion', buildIntervals: (intervals) => [intervals[2], intervals[0] + 12, intervals[1] + 12] }
];

function matchesEnabledShapeTypes(shapeCategories, enabledShapeTypes) {
  const requiredShapeTypes = shapeCategories.filter((category) => SHAPE_TYPE_CATEGORIES.has(category));
  return requiredShapeTypes.length > 0 && requiredShapeTypes.every((category) => enabledShapeTypes.has(category));
}

function cloneShape(shape, chord) {
  return {
    ...shape,
    chordId: chord.id,
    chordLabel: chord.label,
    frets: [...shape.frets],
    fingers: [...shape.fingers],
    barres: (shape.barres || []).map((barre) => ({ ...barre })),
    categories: [...shape.categories]
  };
}

function computeBaseFret(frets) {
  const fretted = frets.filter((fret) => fret > 0);
  if (!fretted.length) return 1;
  const minFret = Math.min(...fretted);
  return minFret > 4 ? minFret : 1;
}

function buildMovableShape({
  id,
  pitchClass,
  quality,
  label,
  frets,
  fingers,
  barres,
  categories,
  difficulty,
  canonicalRank,
  positionScore
}) {
  return {
    id,
    pitchClass,
    quality,
    label,
    frets,
    fingers,
    barres,
    baseFret: computeBaseFret(frets),
    categories,
    difficulty,
    canonicalRank,
    positionScore
  };
}

function rootFretForString(rootPitchClass, stringIndex) {
  return (normalizePitchClass(rootPitchClass) - OPEN_STRING_PITCHES[stringIndex] + 12) % 12;
}

function buildTriadFingers(frets) {
  const orderedFrets = [...new Set(frets.filter((fret) => fret > 0))].sort((left, right) => left - right);
  const fingerByFret = new Map(orderedFrets.map((fret, index) => [fret, Math.min(index + 1, 4)]));
  return frets.map((fret) => (fret > 0 ? fingerByFret.get(fret) : 0));
}

function buildTriadBarres(frets) {
  const playedStrings = frets
    .map((fret, stringIndex) => ({ fret, stringNumber: 6 - stringIndex }))
    .filter(({ fret }) => fret > 0);
  const barres = [];

  for (let index = 0; index < playedStrings.length - 1; index += 1) {
    const current = playedStrings[index];
    const next = playedStrings[index + 1];
    if (current.fret !== next.fret) continue;
    if (current.stringNumber - next.stringNumber !== 1) continue;

    barres.push({
      fret: current.fret,
      fromString: current.stringNumber,
      toString: next.stringNumber,
      finger: 1
    });
  }

  return barres;
}

// Search absolute pitches instead of memorizing fret patterns so every added triad is derived
// from the chord's actual intervals against standard tuning.
function findClosedTriadVoicing(rootPitchClass, orderedIntervals, stringIndexes) {
  const normalizedRoot = normalizePitchClass(rootPitchClass);
  let best = null;

  for (let rootMidi = 24 + normalizedRoot; rootMidi <= 72; rootMidi += 12) {
    const frets = stringIndexes.map(
      (stringIndex, intervalIndex) => rootMidi + orderedIntervals[intervalIndex] - OPEN_STRING_MIDIS[stringIndex]
    );
    if (frets.some((fret) => fret <= 0 || fret > 15)) continue;

    const minFret = Math.min(...frets);
    const maxFret = Math.max(...frets);
    if (maxFret - minFret > 4) continue;

    const averageFretValue = frets.reduce((sum, fret) => sum + fret, 0) / frets.length;
    if (!best || averageFretValue < best.averageFretValue) {
      best = { frets, averageFretValue };
    }
  }

  return best;
}

function makeAdjacentStringTriads(rootPitchClass, quality) {
  const intervals = TRIAD_QUALITY_INTERVALS[quality];
  if (!intervals) return [];

  const categories = quality === 'sus2' || quality === 'sus4' ? ['triad', 'sus/add'] : ['triad'];
  const shapes = [];

  for (const stringGroup of TRIAD_STRING_GROUPS) {
    for (const inversion of TRIAD_INVERSION_INTERVALS) {
      const voicing = findClosedTriadVoicing(rootPitchClass, inversion.buildIntervals(intervals), stringGroup.stringIndexes);
      if (!voicing) continue;

      const frets = [-1, -1, -1, -1, -1, -1];
      for (let index = 0; index < stringGroup.stringIndexes.length; index += 1) {
        frets[stringGroup.stringIndexes[index]] = voicing.frets[index];
      }

      const fingers = buildTriadFingers(frets);
      const inversionRank = inversion.id === 'root-position' ? 0 : inversion.id === '1st-inversion' ? 0.1 : 0.2;

      shapes.push(buildMovableShape({
        id: `${buildChordId(rootPitchClass, quality)}-${stringGroup.id}-${inversion.id}`,
        pitchClass: rootPitchClass,
        quality,
        label: `${stringGroup.label} ${inversion.label} triad`,
        frets,
        fingers,
        barres: buildTriadBarres(frets),
        categories,
        difficulty: stringGroup.difficulty,
        canonicalRank: stringGroup.canonicalRank + inversionRank,
        positionScore: voicing.averageFretValue + stringGroup.positionBias
      }));
    }
  }

  return shapes;
}

function makeSixthStringBarre(rootPitchClass, quality) {
  const rootFret = rootFretForString(rootPitchClass, 0);
  if (rootFret === 0 && (quality === 'maj' || quality === 'min' || quality === '7' || quality === 'min7' || quality === 'maj7')) {
    return null;
  }

  const configs = {
    maj: {
      frets: [rootFret, rootFret + 2, rootFret + 2, rootFret + 1, rootFret, rootFret],
      fingers: [1, 3, 4, 2, 1, 1],
      barres: [{ fret: rootFret, fromString: 6, toString: 1, finger: 1 }],
      label: 'E-shape barre',
      categories: ['barre'],
      difficulty: 3,
      canonicalRank: 14,
      positionScore: rootFret || 1
    },
    min: {
      frets: [rootFret, rootFret + 2, rootFret + 2, rootFret, rootFret, rootFret],
      fingers: [1, 3, 4, 1, 1, 1],
      barres: [{ fret: rootFret, fromString: 6, toString: 1, finger: 1 }],
      label: 'Em-shape barre',
      categories: ['barre'],
      difficulty: 3,
      canonicalRank: 15,
      positionScore: rootFret || 1
    },
    '7': {
      frets: [rootFret, rootFret + 2, rootFret, rootFret + 1, rootFret, rootFret],
      fingers: [1, 3, 1, 2, 1, 1],
      barres: [{ fret: rootFret, fromString: 6, toString: 1, finger: 1 }],
      label: 'E7-shape barre',
      categories: ['barre', 'seventh'],
      difficulty: 3,
      canonicalRank: 18,
      positionScore: rootFret || 1
    },
    min7: {
      frets: [rootFret, rootFret + 2, rootFret, rootFret, rootFret, rootFret],
      fingers: [1, 3, 1, 1, 1, 1],
      barres: [{ fret: rootFret, fromString: 6, toString: 1, finger: 1 }],
      label: 'Em7-shape barre',
      categories: ['barre', 'seventh'],
      difficulty: 3,
      canonicalRank: 19,
      positionScore: rootFret || 1
    },
    maj7: {
      frets: [rootFret, rootFret + 2, rootFret + 1, rootFret + 1, rootFret, rootFret],
      fingers: [1, 4, 2, 3, 1, 1],
      barres: [{ fret: rootFret, fromString: 6, toString: 1, finger: 1 }],
      label: 'Emaj7-shape barre',
      categories: ['barre', 'seventh'],
      difficulty: 4,
      canonicalRank: 21,
      positionScore: rootFret || 1
    },
    '5': {
      frets: [rootFret, rootFret + 2, rootFret + 2, -1, -1, -1],
      fingers: [1, 3, 4, 0, 0, 0],
      barres: [],
      label: 'Sixth-string power',
      categories: ['power'],
      difficulty: 2,
      canonicalRank: 24,
      positionScore: rootFret || 1
    },
    sus2: {
      frets: [rootFret, rootFret + 2, rootFret + 4, rootFret + 4, rootFret, rootFret],
      fingers: [1, 2, 4, 4, 1, 1],
      barres: [{ fret: rootFret, fromString: 6, toString: 1, finger: 1 }],
      label: 'Esus2-shape barre',
      categories: ['barre', 'sus/add'],
      difficulty: 4,
      canonicalRank: 25,
      positionScore: (rootFret || 1) + 0.4
    },
    sus4: {
      frets: [rootFret, rootFret + 2, rootFret + 2, rootFret + 2, rootFret, rootFret],
      fingers: [1, 3, 4, 4, 1, 1],
      barres: [{ fret: rootFret, fromString: 6, toString: 1, finger: 1 }],
      label: 'Esus4-shape barre',
      categories: ['barre', 'sus/add'],
      difficulty: 3,
      canonicalRank: 25,
      positionScore: (rootFret || 1) + 0.35
    },
    add9: {
      frets: [rootFret, rootFret + 2, rootFret + 4, rootFret + 1, rootFret, rootFret + 2],
      fingers: [1, 2, 4, 1, 1, 3],
      barres: [{ fret: rootFret, fromString: 6, toString: 2, finger: 1 }],
      label: 'Eadd9-shape barre',
      categories: ['barre', 'sus/add'],
      difficulty: 4,
      canonicalRank: 26,
      positionScore: (rootFret || 1) + 0.55
    }
  };

  const config = configs[quality];
  if (!config) return null;
  return buildMovableShape({
    id: `${buildChordId(rootPitchClass, quality)}-sixth-root`,
    pitchClass: rootPitchClass,
    quality,
    ...config
  });
}

function makeFifthStringBarre(rootPitchClass, quality) {
  const rootFret = rootFretForString(rootPitchClass, 1);
  if (rootFret === 0 && (quality === 'maj' || quality === 'min' || quality === '7' || quality === 'min7' || quality === 'maj7')) {
    return null;
  }

  const configs = {
    maj: {
      frets: [-1, rootFret, rootFret + 2, rootFret + 2, rootFret + 2, rootFret],
      fingers: [0, 1, 2, 3, 4, 1],
      barres: [{ fret: rootFret, fromString: 5, toString: 1, finger: 1 }],
      label: 'A-shape barre',
      categories: ['barre'],
      difficulty: 3,
      canonicalRank: 13,
      positionScore: rootFret || 1
    },
    min: {
      frets: [-1, rootFret, rootFret + 2, rootFret + 2, rootFret + 1, rootFret],
      fingers: [0, 1, 3, 4, 2, 1],
      barres: [{ fret: rootFret, fromString: 5, toString: 1, finger: 1 }],
      label: 'Am-shape barre',
      categories: ['barre'],
      difficulty: 3,
      canonicalRank: 16,
      positionScore: rootFret || 1
    },
    '7': {
      frets: [-1, rootFret, rootFret + 2, rootFret, rootFret + 2, rootFret],
      fingers: [0, 1, 3, 1, 4, 1],
      barres: [{ fret: rootFret, fromString: 5, toString: 1, finger: 1 }],
      label: 'A7-shape barre',
      categories: ['barre', 'seventh'],
      difficulty: 4,
      canonicalRank: 17,
      positionScore: rootFret || 1
    },
    min7: {
      frets: [-1, rootFret, rootFret + 2, rootFret, rootFret + 1, rootFret],
      fingers: [0, 1, 4, 1, 2, 1],
      barres: [{ fret: rootFret, fromString: 5, toString: 1, finger: 1 }],
      label: 'Am7-shape barre',
      categories: ['barre', 'seventh'],
      difficulty: 4,
      canonicalRank: 20,
      positionScore: rootFret || 1
    },
    maj7: {
      frets: [-1, rootFret, rootFret + 2, rootFret + 1, rootFret + 2, rootFret],
      fingers: [0, 1, 3, 2, 4, 1],
      barres: [{ fret: rootFret, fromString: 5, toString: 1, finger: 1 }],
      label: 'Amaj7-shape barre',
      categories: ['barre', 'seventh'],
      difficulty: 4,
      canonicalRank: 22,
      positionScore: rootFret || 1
    },
    '5': {
      frets: [-1, rootFret, rootFret + 2, rootFret + 2, -1, -1],
      fingers: [0, 1, 3, 4, 0, 0],
      barres: [],
      label: 'Fifth-string power',
      categories: ['power'],
      difficulty: 2,
      canonicalRank: 23,
      positionScore: rootFret || 1
    },
    sus2: {
      frets: [-1, rootFret, rootFret + 2, rootFret + 2, rootFret, rootFret],
      fingers: [0, 1, 3, 4, 1, 1],
      barres: [{ fret: rootFret, fromString: 5, toString: 1, finger: 1 }],
      label: 'Asus2-shape barre',
      categories: ['barre', 'sus/add'],
      difficulty: 3,
      canonicalRank: 25,
      positionScore: (rootFret || 1) + 0.35
    },
    sus4: {
      frets: [-1, rootFret, rootFret + 2, rootFret + 2, rootFret + 3, rootFret],
      fingers: [0, 1, 2, 3, 4, 1],
      barres: [{ fret: rootFret, fromString: 5, toString: 1, finger: 1 }],
      label: 'Asus4-shape barre',
      categories: ['barre', 'sus/add'],
      difficulty: 4,
      canonicalRank: 25,
      positionScore: (rootFret || 1) + 0.45
    },
    add9: {
      frets: [-1, rootFret, rootFret + 2, rootFret + 4, rootFret + 2, rootFret],
      fingers: [0, 1, 2, 4, 3, 1],
      barres: [{ fret: rootFret, fromString: 5, toString: 1, finger: 1 }],
      label: 'Aadd9-shape barre',
      categories: ['barre', 'sus/add'],
      difficulty: 4,
      canonicalRank: 26,
      positionScore: (rootFret || 1) + 0.55
    }
  };

  const config = configs[quality];
  if (!config) return null;
  return buildMovableShape({
    id: `${buildChordId(rootPitchClass, quality)}-fifth-root`,
    pitchClass: rootPitchClass,
    quality,
    ...config
  });
}

function makeFourthStringShape(rootPitchClass, quality) {
  const rootFret = rootFretForString(rootPitchClass, 2);

  const configs = {
    maj: {
      frets: [-1, -1, rootFret, rootFret + 2, rootFret + 3, rootFret + 2],
      fingers: [0, 0, 1, 2, 4, 3],
      barres: [],
      label: 'D-shape triad',
      categories: ['triad'],
      difficulty: 2,
      canonicalRank: 27,
      positionScore: (rootFret || 1) + 0.25
    },
    min: {
      frets: [-1, -1, rootFret, rootFret + 2, rootFret + 3, rootFret + 1],
      fingers: [0, 0, 1, 3, 4, 2],
      barres: [],
      label: 'Dm-shape triad',
      categories: ['triad'],
      difficulty: 2,
      canonicalRank: 28,
      positionScore: (rootFret || 1) + 0.25
    },
    dim: {
      frets: [-1, -1, rootFret, rootFret + 1, rootFret + 3, rootFret + 1],
      fingers: [0, 0, 1, 2, 4, 2],
      barres: [],
      label: 'Ddim-shape triad',
      categories: ['triad'],
      difficulty: 3,
      canonicalRank: 29,
      positionScore: (rootFret || 1) + 0.3
    },
    sus2: {
      frets: [-1, -1, rootFret, rootFret + 2, rootFret + 3, rootFret],
      fingers: [0, 0, 1, 2, 4, 1],
      barres: [],
      label: 'Dsus2-shape triad',
      categories: ['triad', 'sus/add'],
      difficulty: 2,
      canonicalRank: 32,
      positionScore: (rootFret || 1) + 0.2
    },
    sus4: {
      frets: [-1, -1, rootFret, rootFret + 2, rootFret + 3, rootFret + 3],
      fingers: [0, 0, 1, 2, 3, 3],
      barres: [{ fret: rootFret + 3, fromString: 2, toString: 1, finger: 3 }],
      label: 'Dsus4-shape triad',
      categories: ['triad', 'sus/add'],
      difficulty: 2,
      canonicalRank: 32,
      positionScore: (rootFret || 1) + 0.2
    },
  };

  const config = configs[quality];
  if (!config) return null;
  return buildMovableShape({
    id: `${buildChordId(rootPitchClass, quality)}-fourth-root`,
    pitchClass: rootPitchClass,
    quality,
    ...config
  });
}

export function hydrateChordLibrary(rawData) {
  return {
    openShapes: rawData.openShapes
  };
}

export async function loadChordLibrary() {
  const response = await fetch(new URL('../data/chord-shapes.json', import.meta.url));
  if (!response.ok) throw new Error('Failed to load chord data');
  const rawData = await response.json();
  return hydrateChordLibrary(rawData);
}

function compareShapes(a, b) {
  return (
    a.canonicalRank - b.canonicalRank ||
    a.difficulty - b.difficulty ||
    a.positionScore - b.positionScore ||
    a.label.localeCompare(b.label)
  );
}

export function getCandidateShapesForChord(chord, library, enabledShapeTypes) {
  const enabled = enabledShapeTypes instanceof Set ? enabledShapeTypes : new Set(enabledShapeTypes);
  const candidates = [];

  for (const shape of library.openShapes) {
    if (shape.pitchClass !== chord.pitchClass || shape.quality !== chord.quality) continue;
    if (!matchesEnabledShapeTypes(shape.categories, enabled)) continue;
    candidates.push(cloneShape(shape, chord));
  }

  const movableFactories = [makeFifthStringBarre, makeSixthStringBarre, makeFourthStringShape, makeAdjacentStringTriads];
  for (const buildShape of movableFactories) {
    const builtShapes = buildShape(chord.pitchClass, chord.quality);
    const shapes = Array.isArray(builtShapes) ? builtShapes : builtShapes ? [builtShapes] : [];
    for (const shape of shapes) {
      if (!matchesEnabledShapeTypes(shape.categories, enabled)) continue;
      candidates.push(cloneShape(shape, chord));
    }
  }

  return candidates.sort(compareShapes);
}

export function getPlayableChordChoices(chordChoices, library, enabledShapeTypes) {
  return chordChoices
    .map((choice) => ({
      ...choice,
      candidates: getCandidateShapesForChord(choice, library, enabledShapeTypes)
    }))
    .filter((choice) => choice.candidates.length);
}

function averageFret(shape) {
  const fretted = shape.frets.filter((fret) => fret > 0);
  if (!fretted.length) return 0;
  return fretted.reduce((sum, fret) => sum + fret, 0) / fretted.length;
}

function countOpenStrings(shape) {
  return shape.frets.filter((fret) => fret === 0).length;
}

function transitionCost(prevShape, nextShape) {
  const prevAvg = averageFret(prevShape);
  const nextAvg = averageFret(nextShape);
  const prevBase = prevShape.baseFret || 1;
  const nextBase = nextShape.baseFret || 1;
  const openBonus = Math.min(countOpenStrings(prevShape), countOpenStrings(nextShape)) * 0.22;
  return Math.abs(prevAvg - nextAvg) * 1.4 + Math.abs(prevBase - nextBase) * 1.1 - openBonus;
}

export function selectShapeSequence(chords, library, enabledShapeTypes, shapeMode, overrides = {}) {
  const candidatesByIndex = chords.map((chord) => getCandidateShapesForChord(chord, library, enabledShapeTypes));
  if (candidatesByIndex.some((candidates) => !candidates.length)) return null;

  let selectedIndices = candidatesByIndex.map(() => 0);

  if (shapeMode === 'best-fit') {
    const scores = candidatesByIndex.map(() => []);
    const parents = candidatesByIndex.map(() => []);

    for (let chordIndex = 0; chordIndex < candidatesByIndex.length; chordIndex += 1) {
      const candidates = candidatesByIndex[chordIndex];
      for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
        const current = candidates[candidateIndex];
        const baseScore = current.positionScore * 0.35 + current.difficulty * 0.5;
        if (chordIndex === 0) {
          scores[chordIndex][candidateIndex] = baseScore;
          parents[chordIndex][candidateIndex] = -1;
          continue;
        }

        let bestScore = Infinity;
        let bestParent = 0;
        for (let previousIndex = 0; previousIndex < candidatesByIndex[chordIndex - 1].length; previousIndex += 1) {
          const parentScore = scores[chordIndex - 1][previousIndex]
            + transitionCost(candidatesByIndex[chordIndex - 1][previousIndex], current)
            + baseScore;
          if (parentScore < bestScore) {
            bestScore = parentScore;
            bestParent = previousIndex;
          }
        }

        scores[chordIndex][candidateIndex] = bestScore;
        parents[chordIndex][candidateIndex] = bestParent;
      }
    }

    let bestTailIndex = 0;
    let bestTailScore = Infinity;
    const lastScores = scores[scores.length - 1];
    for (let index = 0; index < lastScores.length; index += 1) {
      if (lastScores[index] < bestTailScore) {
        bestTailScore = lastScores[index];
        bestTailIndex = index;
      }
    }

    selectedIndices = selectedIndices.map(() => 0);
    for (let chordIndex = chords.length - 1; chordIndex >= 0; chordIndex -= 1) {
      selectedIndices[chordIndex] = bestTailIndex;
      bestTailIndex = parents[chordIndex][bestTailIndex];
      if (bestTailIndex < 0) break;
    }
  }

  const preferredIndices = [...selectedIndices];

  const selected = candidatesByIndex.map((candidates, index) => {
    const overrideIndex = overrides[index];
    if (Number.isInteger(overrideIndex) && overrideIndex >= 0 && overrideIndex < candidates.length) {
      selectedIndices[index] = overrideIndex;
    }
    return candidates[selectedIndices[index]];
  });

  return {
    selected,
    preferredIndices,
    selectedIndices,
    candidatesByIndex
  };
}
