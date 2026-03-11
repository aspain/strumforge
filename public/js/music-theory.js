export const FRIENDLY_NOTES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

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
  '5': '5',
  '7': '7',
  maj7: 'maj7',
  min7: 'm7',
  sus2: 'sus2',
  sus4: 'sus4',
  add9: 'add9'
};

export const DEGREE_MAP = {
  major: [
    { degree: 1, numeral: 'I', functionLabel: 'tonic', quality: 'maj' },
    { degree: 2, numeral: 'ii', functionLabel: 'predominant', quality: 'min' },
    { degree: 3, numeral: 'iii', functionLabel: 'tonic color', quality: 'min' },
    { degree: 4, numeral: 'IV', functionLabel: 'predominant', quality: 'maj' },
    { degree: 5, numeral: 'V', functionLabel: 'dominant', quality: 'maj' },
    { degree: 6, numeral: 'vi', functionLabel: 'tonic color', quality: 'min' },
    { degree: 7, numeral: 'vii°', functionLabel: 'leading tone', quality: 'dim' }
  ],
  minor: [
    { degree: 1, numeral: 'i', functionLabel: 'tonic', quality: 'min' },
    { degree: 2, numeral: 'ii°', functionLabel: 'predominant', quality: 'dim' },
    { degree: 3, numeral: 'III', functionLabel: 'tonic color', quality: 'maj' },
    { degree: 4, numeral: 'iv', functionLabel: 'predominant', quality: 'min' },
    { degree: 5, numeral: 'v', functionLabel: 'dominant', quality: 'min' },
    { degree: 6, numeral: 'VI', functionLabel: 'tonic color', quality: 'maj' },
    { degree: 7, numeral: 'VII', functionLabel: 'dominant color', quality: 'maj' }
  ]
};

const SCALE_INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10]
};

export function normalizePitchClass(value) {
  if (typeof value === 'number') return ((value % 12) + 12) % 12;
  const trimmed = String(value).trim();
  if (!NOTE_ALIASES.has(trimmed)) throw new Error(`Unknown note: ${value}`);
  return NOTE_ALIASES.get(trimmed);
}

export function pitchClassToNote(pitchClass) {
  return FRIENDLY_NOTES[normalizePitchClass(pitchClass)];
}

export function transposePitchClass(root, semitones) {
  return normalizePitchClass(normalizePitchClass(root) + semitones);
}

export function buildChordId(pitchClass, quality) {
  return `${pitchClassToNote(pitchClass)}:${quality}`;
}

export function formatChordLabel(pitchClass, quality) {
  const note = pitchClassToNote(pitchClass);
  const suffix = QUALITY_LABELS[quality] ?? quality;
  return `${note}${suffix}`;
}

export function getDegreeInfo(mode, degree) {
  const info = DEGREE_MAP[mode].find((entry) => entry.degree === degree);
  if (!info) throw new Error(`Unknown degree ${degree} for mode ${mode}`);
  return info;
}

export function buildChordDefinition(rootPitchClass, mode, degree, qualityOverride) {
  const degreeInfo = getDegreeInfo(mode, degree);
  const pitchClass = transposePitchClass(rootPitchClass, SCALE_INTERVALS[mode][degree - 1]);
  const quality = qualityOverride || degreeInfo.quality;
  return {
    id: buildChordId(pitchClass, quality),
    pitchClass,
    quality,
    label: formatChordLabel(pitchClass, quality),
    degree,
    numeral: degreeInfo.numeral,
    functionLabel: degreeInfo.functionLabel,
    mode
  };
}

export function buildScale(mode, rootPitchClass) {
  return SCALE_INTERVALS[mode].map((interval) => transposePitchClass(rootPitchClass, interval));
}

export function listPitchClasses() {
  return FRIENDLY_NOTES.map((_, index) => index);
}
