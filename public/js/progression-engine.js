import { buildChordDefinition, listPitchClasses, normalizeMode } from './music-theory.js';
import { getPlayableChordChoices } from './chord-library.js';

export const NO_PLAYABLE_LOOP_WARNING = 'No playable loop with the current chord shapes.';
export const LOCKED_KEY_CHORD_SHAPES_WARNING = 'That key does not fit your current chord shapes. Try unlocking the key or turning on Barre chords.';

export const PROGRESSION_TEMPLATES = {
  ionian: [
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
  dorian: [
    { degrees: [1, 4, 7, 1], weight: 1.35 },
    { degrees: [1, 7, 4, 1], weight: 1.18 },
    { degrees: [1, 2, 4, 1], weight: 0.94 },
    { degrees: [1, 4, 1, 7], weight: 0.92 },
    { degrees: [1, 5, 4, 1], weight: 0.82 }
  ],
  phrygian: [
    { degrees: [1, 2, 7, 1], weight: 1.34 },
    { degrees: [1, 2, 4, 1], weight: 1.08 },
    { degrees: [1, 7, 2, 1], weight: 0.96 },
    { degrees: [1, 2, 6, 7], weight: 0.84 },
    { degrees: [1, 4, 2, 1], weight: 0.8 }
  ],
  lydian: [
    { degrees: [1, 2, 5, 1], weight: 1.32 },
    { degrees: [1, 2, 6, 5], weight: 1.02 },
    { degrees: [1, 5, 2, 1], weight: 0.94 },
    { degrees: [1, 2, 1, 5], weight: 0.9 },
    { degrees: [1, 3, 2, 5], weight: 0.78 }
  ],
  mixolydian: [
    { degrees: [1, 7, 4, 1], weight: 1.36 },
    { degrees: [1, 7, 4, 7], weight: 1.08 },
    { degrees: [1, 4, 7, 1], weight: 1.02 },
    { degrees: [1, 5, 4, 1], weight: 0.92 },
    { degrees: [1, 7, 1, 4], weight: 0.86 }
  ],
  aeolian: [
    { degrees: [1, 7, 6, 7], weight: 1.3 },
    { degrees: [1, 6, 3, 7], weight: 1.1 },
    { degrees: [1, 4, 6, 7], weight: 1.0 },
    { degrees: [6, 7, 1, 1], weight: 0.9 },
    { degrees: [1, 4, 1, 7], weight: 0.88 }
  ],
  locrian: [
    { degrees: [1, 2, 7, 1], weight: 1.24 },
    { degrees: [1, 4, 2, 1], weight: 1.0 },
    { degrees: [1, 2, 5, 1], weight: 0.9 },
    { degrees: [1, 2, 7, 4], weight: 0.82 },
    { degrees: [1, 4, 7, 2], weight: 0.76 }
  ],
  blues: [
    { degrees: [1, 4, 1, 5], weight: 1.4 },
    { degrees: [1, 4, 5, 4], weight: 1.18 },
    { degrees: [1, 1, 4, 5], weight: 1.06 },
    { degrees: [1, 4, 1, 1], weight: 0.9 },
    { degrees: [1, 6, 2, 5], weight: 0.88 },
    { degrees: [1, 7, 4, 5], weight: 0.76 }
  ]
};

const FUNCTIONAL_TEMPLATE_SKELETONS = {
  ionian: [
    { roles: ['tonic-family', 'predominant', 'dominant-family', 'tonic'], weight: 0.78 },
    { roles: ['tonic', 'dominant-family', 'predominant', 'tonic'], weight: 0.72 },
    { roles: ['predominant', 'tonic', 'dominant-family', 'tonic'], weight: 0.68 },
    { roles: ['tonic', 'predominant', 'tonic', 'dominant-family'], weight: 0.62 },
    { roles: ['tonic', 'dominant-family', 'tonic', 'predominant'], weight: 0.58 },
    { roles: ['dominant-family', 'predominant', 'tonic', 'dominant-family'], weight: 0.52 }
  ],
  aeolian: [
    { roles: ['tonic-family', 'dominant-family', 'tonic-family', 'dominant-family'], weight: 0.78 },
    { roles: ['tonic-family', 'predominant', 'dominant-family', 'tonic'], weight: 0.72 },
    { roles: ['tonic-family', 'tonic-color', 'dominant-family', 'tonic-family'], weight: 0.66 },
    { roles: ['dominant-family', 'tonic-family', 'predominant', 'dominant-family'], weight: 0.6 },
    { roles: ['tonic', 'predominant', 'tonic-family', 'dominant-family'], weight: 0.56 },
    { roles: ['tonic-family', 'dominant-family', 'tonic', 'tonic-color'], weight: 0.5 }
  ]
};

const DEGREE_PREFERENCE = {
  1: 1,
  2: 0.9,
  3: 0.84,
  4: 0.94,
  5: 0.98,
  6: 0.88,
  7: 0.8
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

function listPlayableDegrees(rootPitchClass, mode, enabledShapeTypes, enabledFlavorOptions, library) {
  const playableDegrees = [];

  for (let degree = 1; degree <= 7; degree += 1) {
    const baseChord = {
      rootPitchClass,
      mode,
      degree,
      quality: buildChordDefinition(rootPitchClass, mode, degree).quality
    };
    const playableChoices = getPlayableChordChoices(
      buildVariationChoices(baseChord, enabledFlavorOptions, enabledShapeTypes).map(finalizeChord),
      library,
      enabledShapeTypes
    );

    if (!playableChoices.length) continue;
    playableDegrees.push({
      degree,
      functionLabel: buildChordDefinition(rootPitchClass, mode, degree).functionLabel
    });
  }

  return playableDegrees;
}

function buildRoleDegreePools(playableDegrees) {
  const pools = {
    tonic: [],
    'tonic-family': [],
    'tonic-color': [],
    predominant: [],
    'dominant-family': []
  };

  playableDegrees.forEach(({ degree, functionLabel }) => {
    if (functionLabel === 'tonic') {
      pools.tonic.push(degree);
      pools['tonic-family'].push(degree);
      return;
    }

    if (functionLabel === 'tonic color') {
      pools['tonic-family'].push(degree);
      pools['tonic-color'].push(degree);
      return;
    }

    if (functionLabel === 'predominant') {
      pools.predominant.push(degree);
      return;
    }

    if (functionLabel === 'dominant' || functionLabel === 'dominant color' || functionLabel === 'leading tone') {
      pools['dominant-family'].push(degree);
    }
  });

  return pools;
}

function buildFunctionalTemplates(mode, playableDegrees) {
  const skeletons = FUNCTIONAL_TEMPLATE_SKELETONS[mode];
  if (!skeletons?.length) return [];

  const templates = [];
  const pools = buildRoleDegreePools(playableDegrees);
  const seen = new Set();

  skeletons.forEach((skeleton) => {
    const rolePools = skeleton.roles.map((role) => pools[role] || []);
    if (rolePools.some((pool) => !pool.length)) return;

    const selectedDegrees = [];

    function visit(roleIndex) {
      if (roleIndex >= rolePools.length) {
        if (new Set(selectedDegrees).size < 2) return;

        const signature = selectedDegrees.join('-');
        if (seen.has(signature)) return;
        seen.add(signature);

        const degreeWeight = selectedDegrees.reduce((sum, degree) => sum + (DEGREE_PREFERENCE[degree] || 0.75), 0) / selectedDegrees.length;
        templates.push({
          degrees: [...selectedDegrees],
          weight: skeleton.weight * degreeWeight
        });
        return;
      }

      rolePools[roleIndex].forEach((degree) => {
        selectedDegrees.push(degree);
        visit(roleIndex + 1);
        selectedDegrees.pop();
      });
    }

    visit(0);
  });

  return templates;
}

function listTemplatesForKey(rootPitchClass, mode, enabledShapeTypes, enabledFlavorOptions, library) {
  const playableDegrees = listPlayableDegrees(
    rootPitchClass,
    mode,
    enabledShapeTypes,
    enabledFlavorOptions,
    library
  );
  const templatesBySignature = new Map(
    (PROGRESSION_TEMPLATES[mode] || []).map((template) => [template.degrees.join('-'), template])
  );

  buildFunctionalTemplates(mode, playableDegrees).forEach((template) => {
    const signature = template.degrees.join('-');
    if (templatesBySignature.has(signature)) return;
    templatesBySignature.set(signature, template);
  });

  return Array.from(templatesBySignature.values());
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
  const modes = state.modePreference === 'auto'
    ? ['ionian', 'aeolian']
    : [normalizeMode(state.modePreference || 'ionian')];
  const roots = hasFixedKey(state) ? [state.keyRoot] : listPitchClasses();

  const feasiblePlans = [];
  for (const mode of modes) {
    for (const rootPitchClass of roots) {
      const templates = listTemplatesForKey(
        rootPitchClass,
        mode,
        enabledShapeTypes,
        enabledFlavorOptions,
        library
      );

      for (const template of templates) {
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
  const targetMode = state.modePreference === 'auto'
    ? existingProgression.mode
    : normalizeMode(state.modePreference || existingProgression.mode);
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
