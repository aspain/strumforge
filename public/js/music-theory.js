export const FRIENDLY_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const NOTE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL_PITCH_CLASSES = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11
};

const TONIC_SPELLING_CANDIDATES = {
  0: ['C', 'B#'],
  1: ['Db', 'C#'],
  2: ['D'],
  3: ['Eb', 'D#'],
  4: ['E', 'Fb'],
  5: ['F', 'E#'],
  6: ['F#', 'Gb'],
  7: ['G'],
  8: ['Ab', 'G#'],
  9: ['A'],
  10: ['Bb', 'A#'],
  11: ['B', 'Cb']
};

const MODE_ALIASES = {
  major: 'ionian',
  minor: 'aeolian'
};

const MODE_DISPLAY_NAMES = {
  ionian: 'Ionian',
  dorian: 'Dorian',
  phrygian: 'Phrygian',
  lydian: 'Lydian',
  mixolydian: 'Mixolydian',
  aeolian: 'Aeolian',
  locrian: 'Locrian',
  blues: 'Blues'
};

const NOTE_ALIASES = new Map([
  ['C', 0],
  ['B#', 0],
  ['C#', 1],
  ['Db', 1],
  ['D', 2],
  ['D#', 3],
  ['Eb', 3],
  ['E', 4],
  ['Fb', 4],
  ['E#', 5],
  ['F', 5],
  ['F#', 6],
  ['Gb', 6],
  ['G', 7],
  ['G#', 8],
  ['Ab', 8],
  ['A', 9],
  ['A#', 10],
  ['Bb', 10],
  ['B', 11],
  ['Cb', 11]
]);

export const QUALITY_LABELS = {
  maj: '',
  min: 'm',
  dim: 'dim',
  '5': '5',
  '7': '7',
  maj7: 'maj7',
  min7: 'm7',
  sus2: 'sus2',
  sus4: 'sus4',
  add9: 'add9'
};

export const DEGREE_MAP = {
  ionian: [
    { degree: 1, numeral: 'I', functionLabel: 'tonic', quality: 'maj' },
    { degree: 2, numeral: 'ii', functionLabel: 'predominant', quality: 'min' },
    { degree: 3, numeral: 'iii', functionLabel: 'tonic color', quality: 'min' },
    { degree: 4, numeral: 'IV', functionLabel: 'predominant', quality: 'maj' },
    { degree: 5, numeral: 'V', functionLabel: 'dominant', quality: 'maj' },
    { degree: 6, numeral: 'vi', functionLabel: 'tonic color', quality: 'min' },
    { degree: 7, numeral: 'vii°', functionLabel: 'leading tone', quality: 'dim' }
  ],
  dorian: [
    { degree: 1, numeral: 'i', functionLabel: 'tonic', quality: 'min' },
    { degree: 2, numeral: 'ii', functionLabel: 'predominant', quality: 'min' },
    { degree: 3, numeral: 'bIII', functionLabel: 'modal color', quality: 'maj' },
    { degree: 4, numeral: 'IV', functionLabel: 'characteristic color', quality: 'maj' },
    { degree: 5, numeral: 'v', functionLabel: 'modal dominant', quality: 'min' },
    { degree: 6, numeral: 'vi°', functionLabel: 'passing diminished', quality: 'dim' },
    { degree: 7, numeral: 'bVII', functionLabel: 'cadential color', quality: 'maj' }
  ],
  phrygian: [
    { degree: 1, numeral: 'i', functionLabel: 'tonic', quality: 'min' },
    { degree: 2, numeral: 'bII', functionLabel: 'characteristic color', quality: 'maj' },
    { degree: 3, numeral: 'bIII', functionLabel: 'tonic color', quality: 'maj' },
    { degree: 4, numeral: 'iv', functionLabel: 'predominant', quality: 'min' },
    { degree: 5, numeral: 'v°', functionLabel: 'passing diminished', quality: 'dim' },
    { degree: 6, numeral: 'bVI', functionLabel: 'modal color', quality: 'maj' },
    { degree: 7, numeral: 'bvii', functionLabel: 'cadential color', quality: 'min' }
  ],
  lydian: [
    { degree: 1, numeral: 'I', functionLabel: 'tonic', quality: 'maj' },
    { degree: 2, numeral: 'II', functionLabel: 'characteristic color', quality: 'maj' },
    { degree: 3, numeral: 'iii', functionLabel: 'tonic color', quality: 'min' },
    { degree: 4, numeral: '#iv°', functionLabel: 'passing diminished', quality: 'dim' },
    { degree: 5, numeral: 'V', functionLabel: 'dominant', quality: 'maj' },
    { degree: 6, numeral: 'vi', functionLabel: 'tonic color', quality: 'min' },
    { degree: 7, numeral: 'vii', functionLabel: 'leading color', quality: 'min' }
  ],
  mixolydian: [
    { degree: 1, numeral: 'I', functionLabel: 'tonic', quality: 'maj' },
    { degree: 2, numeral: 'ii', functionLabel: 'predominant', quality: 'min' },
    { degree: 3, numeral: 'iii°', functionLabel: 'passing diminished', quality: 'dim' },
    { degree: 4, numeral: 'IV', functionLabel: 'predominant', quality: 'maj' },
    { degree: 5, numeral: 'v', functionLabel: 'modal dominant', quality: 'min' },
    { degree: 6, numeral: 'vi', functionLabel: 'tonic color', quality: 'min' },
    { degree: 7, numeral: 'bVII', functionLabel: 'characteristic color', quality: 'maj' }
  ],
  aeolian: [
    { degree: 1, numeral: 'i', functionLabel: 'tonic', quality: 'min' },
    { degree: 2, numeral: 'ii°', functionLabel: 'predominant', quality: 'dim' },
    { degree: 3, numeral: 'III', functionLabel: 'tonic color', quality: 'maj' },
    { degree: 4, numeral: 'iv', functionLabel: 'predominant', quality: 'min' },
    { degree: 5, numeral: 'v', functionLabel: 'dominant', quality: 'min' },
    { degree: 6, numeral: 'VI', functionLabel: 'tonic color', quality: 'maj' },
    { degree: 7, numeral: 'VII', functionLabel: 'dominant color', quality: 'maj' }
  ],
  locrian: [
    { degree: 1, numeral: 'i°', functionLabel: 'tonic', quality: 'dim' },
    { degree: 2, numeral: 'bII', functionLabel: 'characteristic color', quality: 'maj' },
    { degree: 3, numeral: 'biii', functionLabel: 'tonic color', quality: 'min' },
    { degree: 4, numeral: 'iv', functionLabel: 'predominant', quality: 'min' },
    { degree: 5, numeral: 'bV', functionLabel: 'modal color', quality: 'maj' },
    { degree: 6, numeral: 'bVI', functionLabel: 'modal color', quality: 'maj' },
    { degree: 7, numeral: 'bvii', functionLabel: 'cadential color', quality: 'min' }
  ],
  blues: [
    { degree: 1, numeral: 'I7', functionLabel: 'tonic', quality: '7' },
    { degree: 2, numeral: 'ii', functionLabel: 'turnaround', quality: 'min' },
    { degree: 3, numeral: 'iii°', functionLabel: 'passing diminished', quality: 'dim' },
    { degree: 4, numeral: 'IV7', functionLabel: 'subdominant', quality: '7' },
    { degree: 5, numeral: 'V7', functionLabel: 'dominant', quality: '7' },
    { degree: 6, numeral: 'vi', functionLabel: 'turnaround', quality: 'min' },
    { degree: 7, numeral: 'bVII', functionLabel: 'backdoor color', quality: 'maj' }
  ]
};

const SCALE_INTERVALS = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  blues: [0, 2, 4, 5, 7, 9, 10]
};

const SCALE_NOTE_CACHE = new Map();
const TONIC_NAME_CACHE = new Map();

export function normalizeMode(mode) {
  const normalized = MODE_ALIASES[mode] || mode;
  if (!SCALE_INTERVALS[normalized]) throw new Error(`Unknown mode: ${mode}`);
  return normalized;
}

export function getModeDisplayName(mode) {
  return MODE_DISPLAY_NAMES[normalizeMode(mode)];
}

export function normalizePitchClass(value) {
  if (typeof value === 'number') return ((value % 12) + 12) % 12;
  const trimmed = String(value).trim();
  if (!NOTE_ALIASES.has(trimmed)) throw new Error(`Unknown note: ${value}`);
  return NOTE_ALIASES.get(trimmed);
}

export function pitchClassToNote(pitchClass) {
  return FRIENDLY_NOTES[normalizePitchClass(pitchClass)];
}

function parseNoteSpelling(noteName) {
  const match = /^([A-G])([#b]*)$/.exec(noteName);
  if (!match) throw new Error(`Unsupported note spelling: ${noteName}`);

  return {
    letter: match[1],
    accidentalCount: match[2].length
  };
}

function accidentalSuffix(accidentalOffset) {
  if (accidentalOffset > 0) return '#'.repeat(accidentalOffset);
  if (accidentalOffset < 0) return 'b'.repeat(Math.abs(accidentalOffset));
  return '';
}

function relativeAccidentalOffset(naturalPitchClass, targetPitchClass) {
  let offset = normalizePitchClass(targetPitchClass - naturalPitchClass);
  if (offset > 6) offset -= 12;
  return offset;
}

function buildScaleNoteNamesForTonic(tonicName, mode, rootPitchClass) {
  const normalizedMode = normalizeMode(mode);
  const { letter: tonicLetter } = parseNoteSpelling(tonicName);
  const tonicLetterIndex = NOTE_LETTERS.indexOf(tonicLetter);

  return SCALE_INTERVALS[normalizedMode].map((interval, degreeIndex) => {
    const letter = NOTE_LETTERS[(tonicLetterIndex + degreeIndex) % NOTE_LETTERS.length];
    const targetPitchClass = transposePitchClass(rootPitchClass, interval);
    const naturalPitchClass = NATURAL_PITCH_CLASSES[letter];
    const accidentalOffset = relativeAccidentalOffset(naturalPitchClass, targetPitchClass);
    return `${letter}${accidentalSuffix(accidentalOffset)}`;
  });
}

function scoreScaleSpelling(tonicName, scaleNotes) {
  const tonicInfo = parseNoteSpelling(tonicName);
  return scaleNotes.reduce((score, noteName, degreeIndex) => {
    const { accidentalCount } = parseNoteSpelling(noteName);
    const doubleAccidentalPenalty = accidentalCount > 1 ? 8 + accidentalCount : 0;
    const tonicPenalty = degreeIndex === 0 ? tonicInfo.accidentalCount * 0.15 : 0;
    return score + accidentalCount + doubleAccidentalPenalty + tonicPenalty;
  }, 0);
}

function chooseTonicSpelling(mode, rootPitchClass) {
  const normalizedMode = normalizeMode(mode);
  const normalizedRoot = normalizePitchClass(rootPitchClass);
  const cacheKey = `${normalizedMode}:${normalizedRoot}`;
  if (TONIC_NAME_CACHE.has(cacheKey)) return TONIC_NAME_CACHE.get(cacheKey);

  const candidates = TONIC_SPELLING_CANDIDATES[normalizedRoot] || [pitchClassToNote(normalizedRoot)];
  let bestCandidate = candidates[0];
  let bestScore = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate) => {
    const scaleNotes = buildScaleNoteNamesForTonic(candidate, normalizedMode, normalizedRoot);
    const score = scoreScaleSpelling(candidate, scaleNotes);
    if (score < bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  });

  TONIC_NAME_CACHE.set(cacheKey, bestCandidate);
  return bestCandidate;
}

function buildScaleNoteNames(mode, rootPitchClass) {
  const normalizedMode = normalizeMode(mode);
  const normalizedRoot = normalizePitchClass(rootPitchClass);
  const cacheKey = `${normalizedMode}:${normalizedRoot}`;
  if (SCALE_NOTE_CACHE.has(cacheKey)) return SCALE_NOTE_CACHE.get(cacheKey);

  const tonicName = chooseTonicSpelling(normalizedMode, normalizedRoot);
  const scaleNotes = buildScaleNoteNamesForTonic(tonicName, normalizedMode, normalizedRoot);
  SCALE_NOTE_CACHE.set(cacheKey, scaleNotes);
  return scaleNotes;
}

export function getKeyTonicName(mode, rootPitchClass) {
  return buildScaleNoteNames(mode, rootPitchClass)[0];
}

export function getScaleNoteName(mode, rootPitchClass, degree) {
  const scaleNotes = buildScaleNoteNames(mode, rootPitchClass);
  const noteName = scaleNotes[degree - 1];
  if (!noteName) throw new Error(`Unknown degree ${degree} for mode ${mode}`);
  return noteName;
}

export function transposePitchClass(root, semitones) {
  return normalizePitchClass(normalizePitchClass(root) + semitones);
}

export function buildChordId(noteOrPitchClass, quality) {
  const noteName = typeof noteOrPitchClass === 'string'
    ? noteOrPitchClass
    : pitchClassToNote(noteOrPitchClass);
  return `${noteName}:${quality}`;
}

export function formatChordLabel(noteOrPitchClass, quality) {
  const note = typeof noteOrPitchClass === 'string'
    ? noteOrPitchClass
    : pitchClassToNote(noteOrPitchClass);
  const suffix = QUALITY_LABELS[quality] ?? quality;
  return `${note}${suffix}`;
}

export function getDegreeInfo(mode, degree) {
  const normalizedMode = normalizeMode(mode);
  const info = DEGREE_MAP[normalizedMode].find((entry) => entry.degree === degree);
  if (!info) throw new Error(`Unknown degree ${degree} for mode ${mode}`);
  return info;
}

export function buildChordDefinition(rootPitchClass, mode, degree, qualityOverride) {
  const normalizedMode = normalizeMode(mode);
  const degreeInfo = getDegreeInfo(normalizedMode, degree);
  const pitchClass = transposePitchClass(rootPitchClass, SCALE_INTERVALS[normalizedMode][degree - 1]);
  const noteName = getScaleNoteName(normalizedMode, rootPitchClass, degree);
  const quality = qualityOverride || degreeInfo.quality;
  return {
    id: buildChordId(noteName, quality),
    pitchClass,
    noteName,
    quality,
    label: formatChordLabel(noteName, quality),
    degree,
    numeral: degreeInfo.numeral,
    functionLabel: degreeInfo.functionLabel,
    mode: normalizedMode
  };
}

export function listPitchClasses() {
  return FRIENDLY_NOTES.map((_, index) => index);
}
