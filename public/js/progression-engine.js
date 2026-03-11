import { buildChordDefinition, listPitchClasses } from './music-theory.js';
import { getPlayableChordChoices } from './chord-library.js';

export const NO_PLAYABLE_LOOP_WARNING = 'No playable loop with the current voicing filters.';

export const PROGRESSION_TEMPLATES = {
  major: [
    { id: 'anthem-rise', degrees: [1, 5, 6, 4], weight: 1.4 },
    { id: 'campfire-resolve', degrees: [1, 4, 5, 1], weight: 1.25 },
    { id: 'warm-loop', degrees: [1, 6, 4, 5], weight: 1.2 },
    { id: 'lift-and-return', degrees: [6, 4, 1, 5], weight: 1.0 },
    { id: 'gentle-passing', degrees: [1, 3, 4, 5], weight: 0.72 }
  ],
  minor: [
    { id: 'moody-cycle', degrees: [1, 7, 6, 7], weight: 1.3 },
    { id: 'cinematic-minor', degrees: [1, 6, 3, 7], weight: 1.1 },
    { id: 'minor-folk', degrees: [1, 4, 6, 7], weight: 1.0 },
    { id: 'fall-and-rise', degrees: [6, 7, 1, 1], weight: 0.9 },
    { id: 'dark-return', degrees: [1, 4, 1, 7], weight: 0.88 }
  ]
};

function weightedPick(items, rng) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let cursor = rng() * total;
  for (const item of items) {
    cursor -= item.weight;
    if (cursor <= 0) return item;
  }
  return items[items.length - 1];
}

function choice(baseChord, quality, weight) {
  return {
    ...baseChord,
    id: undefined,
    label: undefined,
    quality,
    weight
  };
}

function buildVariationChoices(baseChord, enabledCategories) {
  const categories = enabledCategories instanceof Set ? enabledCategories : new Set(enabledCategories);
  const choices = [choice(baseChord, baseChord.quality, 1)];

  if (categories.has('seventh')) {
    if (baseChord.quality === 'maj') {
      if (baseChord.degree === 5) choices.push(choice(baseChord, '7', 0.56));
      if (baseChord.degree === 1 || baseChord.degree === 4 || baseChord.degree === 3 || baseChord.degree === 6) {
        choices.push(choice(baseChord, 'maj7', baseChord.degree === 1 ? 0.42 : 0.22));
      }
    }
    if (baseChord.quality === 'min') {
      choices.push(choice(baseChord, 'min7', baseChord.degree === 1 ? 0.38 : 0.26));
    }
  }

  if (categories.has('power') && baseChord.degree !== 3) {
    choices.push(choice(baseChord, '5', baseChord.degree === 5 ? 0.28 : 0.16));
  }

  if (categories.has('sus/add') && baseChord.quality === 'maj') {
    if (baseChord.degree === 1 || baseChord.degree === 4 || baseChord.degree === 5) {
      choices.push(choice(baseChord, 'sus2', 0.18));
      choices.push(choice(baseChord, 'sus4', 0.15));
      choices.push(choice(baseChord, 'add9', 0.12));
    }
  }

  return choices;
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function preferredQualityOrder(baseChord, enabledCategories, previousQuality, strategy) {
  const categories = enabledCategories instanceof Set ? enabledCategories : new Set(enabledCategories);

  if (strategy !== 'reharmonize') {
    return dedupe([
      previousQuality,
      baseChord.quality,
      categories.has('seventh') && (previousQuality === '7' || previousQuality === 'maj7' || previousQuality === 'min7')
        ? previousQuality
        : null,
      categories.has('power') ? '5' : null,
      categories.has('seventh') && baseChord.quality === 'maj' && baseChord.degree === 5 ? '7' : null,
      categories.has('seventh') && baseChord.quality === 'maj' ? 'maj7' : null,
      categories.has('seventh') && baseChord.quality === 'min' ? 'min7' : null,
      categories.has('sus/add') ? 'add9' : null,
      categories.has('sus/add') ? 'sus2' : null,
      categories.has('sus/add') ? 'sus4' : null
    ]);
  }

  if (baseChord.quality === 'maj') {
    if (baseChord.degree === 5) {
      return dedupe([
        categories.has('seventh') ? '7' : null,
        categories.has('sus/add') ? 'sus4' : null,
        categories.has('sus/add') ? 'add9' : null,
        categories.has('sus/add') ? 'sus2' : null,
        categories.has('power') ? '5' : null,
        categories.has('seventh') ? 'maj7' : null,
        baseChord.quality,
        previousQuality
      ]);
    }

    if (baseChord.degree === 1 || baseChord.degree === 4) {
      return dedupe([
        categories.has('sus/add') ? 'add9' : null,
        categories.has('seventh') ? 'maj7' : null,
        categories.has('sus/add') ? 'sus2' : null,
        categories.has('sus/add') ? 'sus4' : null,
        categories.has('power') ? '5' : null,
        baseChord.quality,
        previousQuality
      ]);
    }

    return dedupe([
      categories.has('seventh') ? 'maj7' : null,
      categories.has('power') ? '5' : null,
      baseChord.quality,
      previousQuality
    ]);
  }

  if (baseChord.quality === 'min') {
    return dedupe([
      categories.has('seventh') ? 'min7' : null,
      categories.has('power') && baseChord.degree !== 3 ? '5' : null,
      baseChord.quality,
      previousQuality
    ]);
  }

  return dedupe([previousQuality, baseChord.quality]);
}

function selectDeterministicChoice(playableChoices, baseChord, enabledCategories, previousQuality, strategy) {
  const preferredQualities = preferredQualityOrder(baseChord, enabledCategories, previousQuality, strategy);
  for (const quality of preferredQualities) {
    const match = playableChoices.find((choice) => choice.quality === quality);
    if (match) return match;
  }
  return playableChoices[0];
}

function finalizeChord(chord) {
  return buildChordDefinition(chord.rootPitchClass, chord.mode, chord.degree, chord.quality);
}

function buildBaseChords(rootPitchClass, mode, template) {
  return template.degrees.map((degree) => {
    const chord = buildChordDefinition(rootPitchClass, mode, degree);
    return {
      rootPitchClass,
      mode,
      degree,
      quality: chord.quality
    };
  });
}

function buildPlan(rootPitchClass, mode, template, enabledCategories, library) {
  const baseChords = buildBaseChords(rootPitchClass, mode, template);
  const resolvedChoices = [];

  for (const baseChord of baseChords) {
    const playableChoices = getPlayableChordChoices(
      buildVariationChoices(baseChord, enabledCategories).map(finalizeChord),
      library,
      enabledCategories
    );
    if (!playableChoices.length) return null;
    resolvedChoices.push(playableChoices);
  }

  const comfortWeight = resolvedChoices.reduce((sum, choices) => {
    const minDifficulty = Math.min(...choices.map((option) => option.candidates[0].difficulty));
    return sum + (5 - minDifficulty) * 0.08;
  }, 1);

  return {
    rootPitchClass,
    mode,
    template,
    resolvedChoices,
    weight: template.weight * comfortWeight
  };
}

export function generateProgression(state, library, rng = Math.random) {
  const enabledCategories = state.enabledCategories instanceof Set
    ? state.enabledCategories
    : new Set(state.enabledCategories);
  const modes = state.modePreference === 'auto' ? ['major', 'minor'] : [state.modePreference];
  const roots = state.keyLocked ? [state.keyRoot] : listPitchClasses();

  const feasiblePlans = [];
  for (const mode of modes) {
    for (const rootPitchClass of roots) {
      for (const template of PROGRESSION_TEMPLATES[mode]) {
        const plan = buildPlan(rootPitchClass, mode, template, enabledCategories, library);
        if (plan) feasiblePlans.push(plan);
      }
    }
  }

  if (!feasiblePlans.length) {
    return {
      warning: NO_PLAYABLE_LOOP_WARNING
    };
  }

  const selectedPlan = weightedPick(feasiblePlans, rng);
  const chords = selectedPlan.resolvedChoices.map((choices) => {
    const winner = weightedPick(choices, rng);
    return {
      ...winner,
      theoryChip: `${winner.numeral} • ${winner.functionLabel}`
    };
  });

  return {
    keyRoot: selectedPlan.rootPitchClass,
    mode: selectedPlan.mode,
    templateId: selectedPlan.template.id,
    chords,
    warning: ''
  };
}

export function rebuildProgression(existingProgression, state, library) {
  if (!existingProgression?.chords?.length) {
    return generateProgression(state, library);
  }

  const enabledCategories = state.enabledCategories instanceof Set
    ? state.enabledCategories
    : new Set(state.enabledCategories);
  const targetMode = state.modePreference === 'auto' ? existingProgression.mode : state.modePreference;
  const targetRoot = state.keyLocked ? state.keyRoot : existingProgression.keyRoot;
  const strategy = state.rebuildStrategy === 'reharmonize' ? 'reharmonize' : 'preserve';

  const chords = [];
  for (const previousChord of existingProgression.chords) {
    const baseChord = {
      rootPitchClass: targetRoot,
      mode: targetMode,
      degree: previousChord.degree,
      quality: buildChordDefinition(targetRoot, targetMode, previousChord.degree).quality
    };
    const playableChoices = getPlayableChordChoices(
      buildVariationChoices(baseChord, enabledCategories).map(finalizeChord),
      library,
      enabledCategories
    );

    if (!playableChoices.length) {
      return {
        warning: NO_PLAYABLE_LOOP_WARNING
      };
    }

    const winner = selectDeterministicChoice(
      playableChoices,
      baseChord,
      enabledCategories,
      previousChord.quality,
      strategy
    );
    chords.push({
      ...winner,
      theoryChip: `${winner.numeral} • ${winner.functionLabel}`
    });
  }

  return {
    keyRoot: targetRoot,
    mode: targetMode,
    templateId: existingProgression.templateId,
    chords,
    warning: ''
  };
}
