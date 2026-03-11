import { AudioEngine, GROOVES } from './audio-engine.js';
import { loadChordLibrary, selectShapeSequence } from './chord-library.js';
import { renderChordDiagram } from './chord-diagram.js';
import { FRIENDLY_NOTES, pitchClassToNote } from './music-theory.js';
import {
  generateProgression,
  rebuildProgression,
  getFeasibleKeyRoots,
  NO_PLAYABLE_LOOP_WARNING
} from './progression-engine.js';

const state = {
  keyLocked: false,
  keyRoot: 0,
  modePreference: 'auto',
  enabledShapeTypes: new Set(['open']),
  enabledFlavorOptions: new Set(),
  leftHanded: false,
  tempo: 92,
  meter: '4/4',
  groove: 'folk-pop',
  playDrums: true,
  playChords: false,
  activeChordIndex: -1,
  progression: null,
  shapeOverrides: {}
};

const elements = {
  currentKeyLabel: document.getElementById('current-key-label'),
  beatCounterLabel: document.getElementById('beat-counter-label'),
  keyLockToggle: document.getElementById('key-lock-toggle'),
  keyRootSelect: document.getElementById('key-root-select'),
  leftHandedToggle: document.getElementById('left-handed-toggle'),
  generateButton: document.getElementById('generate-button'),
  warning: document.getElementById('generator-warning'),
  progressionKeyDisplay: document.getElementById('progression-key-display'),
  progressionGrid: document.getElementById('progression-grid'),
  playDrumsToggle: document.getElementById('play-drums-toggle'),
  playChordsToggle: document.getElementById('play-chords-toggle'),
  transportButton: document.getElementById('transport-button'),
  tempoSlider: document.getElementById('tempo-slider'),
  tempoNumber: document.getElementById('tempo-number'),
  meterSelect: document.getElementById('meter-select'),
  grooveSelect: document.getElementById('groove-select'),
  grooveLabel: document.getElementById('groove-label'),
  beatIndicator: document.getElementById('beat-indicator')
};

let chordLibrary;
const audioEngine = new AudioEngine(({ beatIndex, chordIndex }) => {
  renderBeatPulse(beatIndex);
  setActiveChord(chordIndex);
});

function syncTransportMode() {
  audioEngine.setTransportMode({ drums: state.playDrums, chords: state.playChords });
  elements.playDrumsToggle.checked = state.playDrums;
  elements.playChordsToggle.checked = state.playChords;
  elements.transportButton.disabled = !state.playDrums && !state.playChords;
  if (!state.playChords) setActiveChord(-1);
}

function getSelectedShapes() {
  if (!state.progression?.chords?.length || !chordLibrary) return null;
  return selectShapeSequence(
    state.progression.chords,
    chordLibrary,
    state.enabledShapeTypes,
    'best-fit',
    state.shapeOverrides
  );
}

function formatKeyLabel(root, mode) {
  if (!mode) return 'Random';
  return `${pitchClassToNote(root)} ${mode === 'major' ? 'major' : 'minor'}`;
}

function renderKeyOptions() {
  const feasibleRoots = chordLibrary ? getFeasibleKeyRoots(state, chordLibrary) : FRIENDLY_NOTES.map((_, index) => index);
  if (feasibleRoots.length) {
    if (!feasibleRoots.includes(state.keyRoot)) {
      state.keyRoot = feasibleRoots[0];
    }
  } else {
    state.keyRoot = 0;
  }

  elements.keyRootSelect.innerHTML = feasibleRoots
    .map((index) => `<option value="${index}">${FRIENDLY_NOTES[index]}</option>`)
    .join('');
  elements.keyRootSelect.value = String(state.keyRoot);
  elements.keyRootSelect.disabled = !state.keyLocked || feasibleRoots.length === 0;
}

function currentGrooves() {
  return GROOVES.filter((groove) => groove.meter === state.meter);
}

function renderGrooveOptions() {
  const grooves = currentGrooves();
  if (!grooves.some((groove) => groove.id === state.groove)) {
    state.groove = grooves[0].id;
  }
  elements.grooveSelect.innerHTML = grooves
    .map((groove) => `<option value="${groove.id}">${groove.label}</option>`)
    .join('');
  elements.grooveSelect.value = state.groove;
  const groove = GROOVES.find((item) => item.id === state.groove);
  elements.grooveLabel.textContent = groove.label;
  audioEngine.setGroove(state.groove);
  renderBeatPulse(-1);
}

function renderBeatPulse(activeBeat) {
  const groove = GROOVES.find((item) => item.id === state.groove);
  elements.beatCounterLabel.textContent = activeBeat >= 0 ? `Beat ${activeBeat + 1} of ${groove.beatsPerBar}` : '';
  elements.beatIndicator.innerHTML = Array.from({ length: groove.beatsPerBar }, (_, index) => (
    `<div class="beat-dot${index === activeBeat ? ' active' : ''}" aria-label="Beat ${index + 1}"></div>`
  )).join('');
}

function setActiveChord(index) {
  state.activeChordIndex = Number.isInteger(index) ? index : -1;
  elements.progressionGrid.querySelectorAll('[data-chord-card]').forEach((card) => {
    const cardIndex = Number(card.getAttribute('data-chord-card'));
    card.classList.toggle('playing', cardIndex === state.activeChordIndex && state.playChords);
  });
}

function updateStatusLine() {
  elements.currentKeyLabel.textContent = state.progression
    ? formatKeyLabel(state.progression.keyRoot, state.progression.mode)
    : 'Unavailable';
}

function updateWarning(message) {
  elements.warning.textContent = message || '';
}

function updateTransportButton(isPlaying) {
  elements.transportButton.textContent = isPlaying ? 'Stop' : 'Play';
  elements.transportButton.setAttribute('aria-pressed', String(isPlaying));
}

function renderEmptyProgression({
  title = NO_PLAYABLE_LOOP_WARNING
} = {}) {
  setActiveChord(-1);
  audioEngine.setChordSequence([]);
  elements.progressionKeyDisplay.innerHTML = '';
  elements.progressionKeyDisplay.classList.add('is-hidden');
  elements.progressionGrid.classList.add('progression-grid-empty');
  elements.progressionGrid.innerHTML = `
    <article class="chord-card empty-state-card">
      <div class="card-header empty-state-header">
        <div class="card-title-row empty-state-title-row">
          <h3>${title}</h3>
        </div>
      </div>
      <div class="empty-state-visual" aria-hidden="true">
        <div class="empty-state-fretboard">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div class="empty-state-pulse"></div>
      </div>
    </article>
  `;
}

function renderProgression() {
  if (!state.progression || !state.progression.chords?.length) {
    renderEmptyProgression({
      title: elements.warning.textContent || NO_PLAYABLE_LOOP_WARNING
    });
    updateStatusLine();
    return;
  }

  const selectedShapes = getSelectedShapes();

  if (!selectedShapes) {
    updateWarning(NO_PLAYABLE_LOOP_WARNING);
    renderEmptyProgression({
      title: NO_PLAYABLE_LOOP_WARNING
    });
    updateStatusLine();
    return;
  }

  audioEngine.setChordSequence(selectedShapes.selected);
  elements.progressionKeyDisplay.classList.remove('is-hidden');
  elements.progressionGrid.classList.remove('progression-grid-empty');
  elements.progressionKeyDisplay.innerHTML = `
    <span class="progression-key-label">Key</span>
    <strong class="progression-key-title">${formatKeyLabel(state.progression.keyRoot, state.progression.mode)}</strong>
    <span class="progression-loop-name">Progression: ${state.progression.templateId.replaceAll('-', ' ')}</span>
  `;
  elements.progressionGrid.innerHTML = state.progression.chords.map((chord, index) => {
    const shape = selectedShapes.selected[index];
    const totalCandidates = selectedShapes.candidatesByIndex[index].length;
    return `
      <article class="chord-card${index === state.activeChordIndex && state.playChords ? ' playing' : ''}" data-chord-card="${index}">
        <div class="card-header">
          <div class="card-title-row">
            <h3>${chord.label}</h3>
            <span class="voicing-chip">${shape.label}</span>
          </div>
          <div class="card-topline">
            <span class="theory-chip">${chord.theoryChip}</span>
          </div>
        </div>
        <div class="diagram-wrap">${renderChordDiagram(shape, { leftHanded: state.leftHanded })}</div>
        <div class="card-actions">
          <button class="preview-chord" type="button" data-preview-chord="${index}" aria-label="Play ${chord.label}">
            Play
          </button>
          <button
            class="swap-shape"
            type="button"
            data-cycle-shape="${index}"
            ${totalCandidates < 2 ? 'disabled' : ''}
          >
            ${totalCandidates < 2 ? 'Only shape' : `Swap shape (${selectedShapes.selectedIndices[index] + 1}/${totalCandidates})`}
          </button>
        </div>
      </article>
    `;
  }).join('');

  setActiveChord(state.activeChordIndex);
  updateStatusLine();
}

function regenerateProgression() {
  state.shapeOverrides = {};
  const result = generateProgression(state, chordLibrary);
  if (result.warning) {
    state.progression = null;
    updateWarning(result.warning);
    renderProgression();
    return;
  }

  state.progression = result;
  updateWarning('');
  renderProgression();
}

function syncTempo(value) {
  const nextTempo = Math.max(50, Math.min(180, Number(value) || 92));
  state.tempo = nextTempo;
  elements.tempoSlider.value = String(nextTempo);
  elements.tempoNumber.value = String(nextTempo);
  audioEngine.setTempo(nextTempo);
}

function readEnabledShapeTypes() {
  state.enabledShapeTypes = new Set(
    Array.from(document.querySelectorAll('input[name="shape-type"]:checked')).map((node) => node.value)
  );
}

function readEnabledFlavorOptions() {
  state.enabledFlavorOptions = new Set(
    Array.from(document.querySelectorAll('input[name="flavor-option"]:checked')).map((node) => node.value)
  );
}

function applyShapeFilters() {
  state.shapeOverrides = {};
  renderKeyOptions();
  if (!state.progression) {
    regenerateProgression();
    return;
  }
  renderProgression();
}

function refreshProgression(rebuildStrategy = 'preserve') {
  if (!state.progression || !chordLibrary) return;
  state.shapeOverrides = {};
  renderKeyOptions();
  let result = rebuildProgression(
    state.progression,
    { ...state, rebuildStrategy },
    chordLibrary
  );
  if (result.warning) {
    // If preserving the current loop is impossible under the new constraints,
    // fall back to a fresh progression that fits the user's current settings.
    result = generateProgression(state, chordLibrary);
    if (result.warning) {
      state.progression = null;
      updateWarning(result.warning);
      renderProgression();
      return;
    }
  }

  state.progression = result;
  updateWarning('');
  renderProgression();
}

function attachEventListeners() {
  syncTransportMode();
  elements.generateButton.addEventListener('click', regenerateProgression);
  elements.keyLockToggle.addEventListener('change', () => {
    state.keyLocked = elements.keyLockToggle.checked;
    renderKeyOptions();
    refreshProgression('preserve');
  });

  elements.keyRootSelect.addEventListener('change', () => {
    state.keyRoot = Number(elements.keyRootSelect.value);
    refreshProgression('preserve');
  });

  document.querySelectorAll('input[name="mode-preference"]').forEach((node) => {
    node.addEventListener('change', () => {
      state.modePreference = document.querySelector('input[name="mode-preference"]:checked').value;
      renderKeyOptions();
      refreshProgression('preserve');
    });
  });

  document.querySelectorAll('input[name="shape-type"]').forEach((node) => {
    node.addEventListener('change', () => {
      readEnabledShapeTypes();
      if (node.value === 'power' && state.progression?.chords?.some((chord) => chord.quality === '5')) {
        refreshProgression('preserve');
        return;
      }
      applyShapeFilters();
    });
  });

  document.querySelectorAll('input[name="flavor-option"]').forEach((node) => {
    node.addEventListener('change', () => {
      readEnabledFlavorOptions();
      refreshProgression('reharmonize');
    });
  });

  elements.leftHandedToggle.addEventListener('change', () => {
    state.leftHanded = elements.leftHandedToggle.checked;
    renderProgression();
  });

  elements.progressionGrid.addEventListener('click', (event) => {
    const previewButton = event.target.closest('[data-preview-chord]');
    if (previewButton && state.progression) {
      const index = Number(previewButton.getAttribute('data-preview-chord'));
      const selection = getSelectedShapes();
      if (selection?.selected[index]) {
        audioEngine.playChord(selection.selected[index]);
      }
      return;
    }

    const button = event.target.closest('[data-cycle-shape]');
    if (!button || !state.progression) return;
    const index = Number(button.getAttribute('data-cycle-shape'));
    const selection = getSelectedShapes();
    if (!selection) return;
    const total = selection.candidatesByIndex[index].length;
    const currentIndex = selection.selectedIndices[index];
    state.shapeOverrides[index] = (currentIndex + 1) % total;
    renderProgression();
  });

  elements.playDrumsToggle.addEventListener('change', () => {
    state.playDrums = elements.playDrumsToggle.checked;
    syncTransportMode();
    if (!state.playDrums && !state.playChords && audioEngine.isPlaying) {
      audioEngine.stop();
      updateTransportButton(false);
    }
  });

  elements.playChordsToggle.addEventListener('change', () => {
    state.playChords = elements.playChordsToggle.checked;
    syncTransportMode();
    if (!state.playDrums && !state.playChords && audioEngine.isPlaying) {
      audioEngine.stop();
      updateTransportButton(false);
    }
  });

  elements.tempoSlider.addEventListener('input', () => syncTempo(elements.tempoSlider.value));
  elements.tempoNumber.addEventListener('input', () => syncTempo(elements.tempoNumber.value));

  elements.meterSelect.addEventListener('change', () => {
    state.meter = elements.meterSelect.value;
    renderGrooveOptions();
  });

  elements.grooveSelect.addEventListener('change', () => {
    state.groove = elements.grooveSelect.value;
    renderGrooveOptions();
  });

  elements.transportButton.addEventListener('click', async () => {
    const isPlaying = await audioEngine.toggle();
    updateTransportButton(isPlaying);
  });
}

async function init() {
  renderKeyOptions();
  renderGrooveOptions();
  syncTempo(state.tempo);
  syncTransportMode();
  attachEventListeners();
  chordLibrary = await loadChordLibrary();
  renderKeyOptions();
  regenerateProgression();
}

init().catch((error) => {
  updateWarning('Failed to load chord data.');
  renderEmptyProgression({
    title: 'Chord data did not load'
  });
  console.error(error);
});
