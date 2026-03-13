import { buildChordDefinition, listPitchClasses } from './music-theory.js';
import { getPlayableChordChoices } from './chord-library.js';

export const NO_PLAYABLE_LOOP_WARNING = 'No playable loop with the current chord shapes.';
export const LOCKED_KEY_CHORD_SHAPES_WARNING = 'That key does not fit your current chord shapes. Try unlocking the key or turning on Barre chords.';

export const PROGRESSION_TEMPLATES = {
  major: [
    { degrees: [1, 5, 6, 4], weight: 1.4 },
    { degrees: [1, 4, 5, 1], weight: 1.25 },
    { degrees: [1, 6, 4, 5], weight: 1.2 },
    { degrees: [6, 4, 1, 5], weight: 1.0 },
    { degrees: [1, 3, 4, 5], weight: 0.72 },
    { degrees: [1, 6, 2, 5], weight: 0.92 },
    { degrees: [1, 3, 6, 5], weight: 0.88 },
    { degrees: [6, 2, 5, 1], weight: 0.84 },
    { degrees: [1, 5, 3, 6], weight: 0.8 }
  ],
  minor: [
    { degrees: [1, 7, 6, 7], weight: 1.3 },
    { degrees: [1, 6, 3, 7], weight: 1.1 },
    { degrees: [1, 4, 6, 7], weight: 1.0 },
    { degrees: [6, 7, 1, 1], weight: 0.9 },
    { degrees: [1, 4, 1, 7], weight: 0.88 }
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

function buildVariationChoices(baseChord, enabledFlavorOptions, enabledShapeTypes) {
  const flavorOptions = enabledFlavorOptions instanceof Set
    ? enabledFlavorOptions
    : new Set(enabledFlavorOptions);
  const shapeTypes = enabledShapeTypes instanceof Set
    ? enabledShapeTypes
    : new Set(enabledShapeTypes);
  const choices = [choice(baseChord, baseChord.quality, 1)];

  if (flavorOptions.has('seventh')) {
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

  if (shapeTypes.has('power') && baseChord.degree !== 3) {
    choices.push(choice(baseChord, '5', baseChord.degree === 5 ? 0.28 : 0.16));
  }

  if (flavorOptions.has('sus/add') && baseChord.quality === 'maj') {
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

function preferredQualityOrder(baseChord, enabledFlavorOptions, enabledShapeTypes, previousQuality, strategy) {
  const flavorOptions = enabledFlavorOptions instanceof Set
    ? enabledFlavorOptions
    : new Set(enabledFlavorOptions);
  const shapeTypes = enabledShapeTypes instanceof Set
    ? enabledShapeTypes
    : new Set(enabledShapeTypes);

  if (strategy !== 'reharmonize') {
    return dedupe([
      previousQuality,
      baseChord.quality,
      flavorOptions.has('seventh') && (previousQuality === '7' || previousQuality === 'maj7' || previousQuality === 'min7')
        ? previousQuality
        : null,
      shapeTypes.has('power') ? '5' : null,
      flavorOptions.has('seventh') && baseChord.quality === 'maj' && baseChord.degree === 5 ? '7' : null,
      flavorOptions.has('seventh') && baseChord.quality === 'maj' ? 'maj7' : null,
      flavorOptions.has('seventh') && baseChord.quality === 'min' ? 'min7' : null,
      flavorOptions.has('sus/add') ? 'add9' : null,
      flavorOptions.has('sus/add') ? 'sus2' : null,
      flavorOptions.has('sus/add') ? 'sus4' : null
    ]);
  }

  if (baseChord.quality === 'maj') {
    if (baseChord.degree === 5) {
      return dedupe([
        flavorOptions.has('seventh') ? '7' : null,
        flavorOptions.has('sus/add') ? 'sus4' : null,
        flavorOptions.has('sus/add') ? 'add9' : null,
        flavorOptions.has('sus/add') ? 'sus2' : null,
        shapeTypes.has('power') ? '5' : null,
        flavorOptions.has('seventh') ? 'maj7' : null,
        baseChord.quality,
        previousQuality
      ]);
    }

    if (baseChord.degree === 1 || baseChord.degree === 4) {
      return dedupe([
        flavorOptions.has('sus/add') ? 'add9' : null,
        flavorOptions.has('seventh') ? 'maj7' : null,
        flavorOptions.has('sus/add') ? 'sus2' : null,
        flavorOptions.has('sus/add') ? 'sus4' : null,
        shapeTypes.has('power') ? '5' : null,
        baseChord.quality,
        previousQuality
      ]);
    }

    return dedupe([
      flavorOptions.has('seventh') ? 'maj7' : null,
      shapeTypes.has('power') ? '5' : null,
      baseChord.quality,
      previousQuality
    ]);
  }

  if (baseChord.quality === 'min') {
    return dedupe([
      flavorOptions.has('seventh') ? 'min7' : null,
      shapeTypes.has('power') && baseChord.degree !== 3 ? '5' : null,
      baseChord.quality,
      previousQuality
    ]);
  }

  return dedupe([previousQuality, baseChord.quality]);
}

function selectDeterministicChoice(playableChoices, baseChord, enabledFlavorOptions, enabledShapeTypes, previousQuality, strategy) {
  const preferredQualities = preferredQualityOrder(
    baseChord,
    enabledFlavorOptions,
    enabledShapeTypes,
    previousQuality,
    strategy
  );
  for (const quality of preferredQualities) {
    const match = playableChoices.find((choice) => choice.quality === quality);
    if (match) return match;
  }
  return playableChoices[0];
}

function finalizeChord(chord) {
  return {
    ...buildChordDefinition(chord.rootPitchClass, chord.mode, chord.degree, chord.quality),
    weight: chord.weight
  };
}

function decorateProgressionChord(chord) {
  return {
    ...chord,
    theoryChip: `${chord.numeral} • ${chord.functionLabel}`
  };
}

function buildProgressionSignature(progression) {
  if (!progression?.chords?.length) return '';
  return [
    progression.keyRoot,
    progression.mode,
    ...progression.chords.map((chord) => chord.id)
  ].join('|');
}

function buildProgressionFromChoices(rootPitchClass, mode, choices) {
  return {
    keyRoot: rootPitchClass,
    mode,
    chords: choices.map(decorateProgressionChord),
    warning: ''
  };
}

function buildProgressionFromPlan(plan, rng) {
  const winners = plan.resolvedChoices.map((choices) => weightedPick(choices, rng));
  return buildProgressionFromChoices(plan.rootPitchClass, plan.mode, winners);
}

function collectDistinctProgressionVariants(feasiblePlans) {
  const variantsBySignature = new Map();

  feasiblePlans.forEach((plan) => {
    const slotTotals = plan.resolvedChoices.map((choices) => (
      choices.reduce((sum, choice) => sum + choice.weight, 0)
    ));

    function visitChoices(choiceIndex, selectedChoices, relativeWeight) {
      if (choiceIndex >= plan.resolvedChoices.length) {
        const progression = buildProgressionFromChoices(plan.rootPitchClass, plan.mode, selectedChoices);
        const signature = buildProgressionSignature(progression);
        const nextWeight = plan.weight * relativeWeight;
        const existing = variantsBySignature.get(signature);

        if (existing) {
          existing.weight += nextWeight;
          return;
        }

        variantsBySignature.set(signature, {
          ...progression,
          weight: nextWeight
        });
        return;
      }

      const choices = plan.resolvedChoices[choiceIndex];
      const totalWeight = slotTotals[choiceIndex] || 1;
      choices.forEach((choice) => {
        selectedChoices.push(choice);
        visitChoices(choiceIndex + 1, selectedChoices, relativeWeight * (choice.weight / totalWeight));
        selectedChoices.pop();
      });
    }

    visitChoices(0, [], 1);
  });

  return Array.from(variantsBySignature.values());
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

function buildPlan(rootPitchClass, mode, template, enabledShapeTypes, enabledFlavorOptions, library) {
  const baseChords = buildBaseChords(rootPitchClass, mode, template);
  const resolvedChoices = [];

  for (const baseChord of baseChords) {
    const playableChoices = getPlayableChordChoices(
      buildVariationChoices(baseChord, enabledFlavorOptions, enabledShapeTypes).map(finalizeChord),
      library,
      enabledShapeTypes
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
    resolvedChoices,
    weight: template.weight * comfortWeight
  };
}

function buildWarning(state) {
  return hasFixedKey(state) ? LOCKED_KEY_CHORD_SHAPES_WARNING : NO_PLAYABLE_LOOP_WARNING;
}

function hasFixedKey(state) {
  if (typeof state?.keyLocked === 'boolean') {
    return state.keyLocked;
  }

  return Number.isInteger(state?.keyRoot);
}

function collectFeasiblePlans(state, library) {
  const enabledShapeTypes = state.enabledShapeTypes instanceof Set
    ? state.enabledShapeTypes
    : new Set(state.enabledShapeTypes);
  const enabledFlavorOptions = state.enabledFlavorOptions instanceof Set
    ? state.enabledFlavorOptions
    : new Set(state.enabledFlavorOptions);
  const modes = state.modePreference === 'auto' ? ['major', 'minor'] : [state.modePreference];
  const roots = hasFixedKey(state) ? [state.keyRoot] : listPitchClasses();

  const feasiblePlans = [];
  for (const mode of modes) {
    for (const rootPitchClass of roots) {
      for (const template of PROGRESSION_TEMPLATES[mode]) {
        const plan = buildPlan(rootPitchClass, mode, template, enabledShapeTypes, enabledFlavorOptions, library);
        if (plan) feasiblePlans.push(plan);
      }
    }
  }

  return feasiblePlans;
}

export function getFeasibleKeyRoots(state, library) {
  const feasiblePlans = collectFeasiblePlans(
    {
      ...state,
      keyLocked: false,
      keyRoot: null
    },
    library
  );
  return [...new Set(feasiblePlans.map((plan) => plan.rootPitchClass))];
}

export function generateProgression(state, library, rng = Math.random) {
  const feasiblePlans = collectFeasiblePlans(state, library);

  if (!feasiblePlans.length) {
    return {
      warning: buildWarning(state)
    };
  }

  const selectedPlan = weightedPick(feasiblePlans, rng);
  return buildProgressionFromPlan(selectedPlan, rng);
}

export function generateDistinctProgression(state, library, previousProgression, rng = Math.random) {
  const feasiblePlans = collectFeasiblePlans(state, library);

  if (!feasiblePlans.length) {
    return {
      warning: buildWarning(state)
    };
  }

  if (!previousProgression?.chords?.length) {
    return buildProgressionFromPlan(weightedPick(feasiblePlans, rng), rng);
  }

  const excludedSignature = buildProgressionSignature(previousProgression);
  const alternatives = collectDistinctProgressionVariants(feasiblePlans)
    .filter((progression) => buildProgressionSignature(progression) !== excludedSignature);

  if (!alternatives.length) {
    return buildProgressionFromPlan(weightedPick(feasiblePlans, rng), rng);
  }

  const selectedAlternative = weightedPick(alternatives, rng);
  return {
    keyRoot: selectedAlternative.keyRoot,
    mode: selectedAlternative.mode,
    chords: selectedAlternative.chords,
    warning: ''
  };
}

export function rebuildProgression(existingProgression, state, library) {
  if (!existingProgression?.chords?.length) {
    return generateProgression(state, library);
  }

  const enabledShapeTypes = state.enabledShapeTypes instanceof Set
    ? state.enabledShapeTypes
    : new Set(state.enabledShapeTypes);
  const enabledFlavorOptions = state.enabledFlavorOptions instanceof Set
    ? state.enabledFlavorOptions
    : new Set(state.enabledFlavorOptions);
  const targetMode = state.modePreference === 'auto' ? existingProgression.mode : state.modePreference;
  const targetRoot = hasFixedKey(state) ? state.keyRoot : existingProgression.keyRoot;
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
      buildVariationChoices(baseChord, enabledFlavorOptions, enabledShapeTypes).map(finalizeChord),
      library,
      enabledShapeTypes
    );

    if (!playableChoices.length) {
      return {
        warning: buildWarning(state)
      };
    }

    const winner = selectDeterministicChoice(
      playableChoices,
      baseChord,
      enabledFlavorOptions,
      enabledShapeTypes,
      previousChord.quality,
      strategy
    );
    chords.push(decorateProgressionChord(winner));
  }

  return {
    keyRoot: targetRoot,
    mode: targetMode,
    chords,
    warning: ''
  };
}
