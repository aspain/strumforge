import { AudioEngine, GROOVES } from './audio-engine.js';
import { loadChordLibrary, selectShapeSequence } from './chord-library.js';
import { renderChordDiagram } from './chord-diagram.js';
import { FRIENDLY_NOTES, pitchClassToNote } from './music-theory.js';
import { generateProgression } from './progression-engine.js';

const state = {
  keyLocked: false,
  keyRoot: 0,
  modePreference: 'auto',
  enabledCategories: new Set(['open', 'barre', 'seventh']),
  shapeMode: 'canonical',
  leftHanded: false,
  tempo: 92,
  meter: '4/4',
  groove: 'folk-pop',
  progression: null,
  shapeOverrides: {}
};

const elements = {
  currentKeyLabel: document.getElementById('current-key-label'),
  shapeModeLabel: document.getElementById('shape-mode-label'),
  keyLockToggle: document.getElementById('key-lock-toggle'),
  keyRootSelect: document.getElementById('key-root-select'),
  leftHandedToggle: document.getElementById('left-handed-toggle'),
  generateButton: document.getElementById('generate-button'),
  warning: document.getElementById('generator-warning'),
  progressionGrid: document.getElementById('progression-grid'),
  progressionMeta: document.getElementById('progression-meta'),
  transportButton: document.getElementById('transport-button'),
  tempoSlider: document.getElementById('tempo-slider'),
  tempoNumber: document.getElementById('tempo-number'),
  meterSelect: document.getElementById('meter-select'),
  grooveSelect: document.getElementById('groove-select'),
  grooveLabel: document.getElementById('groove-label'),
  beatIndicator: document.getElementById('beat-indicator')
};

let chordLibrary;
const audioEngine = new AudioEngine((beatIndex) => renderBeatPulse(beatIndex));

function formatKeyLabel(root, mode) {
  if (!mode) return 'Random';
  return `${pitchClassToNote(root)} ${mode === 'major' ? 'major' : 'minor'}`;
}

function renderKeyOptions() {
  elements.keyRootSelect.innerHTML = FRIENDLY_NOTES
    .map((note, index) => `<option value="${index}">${note}</option>`)
    .join('');
  elements.keyRootSelect.value = String(state.keyRoot);
  elements.keyRootSelect.disabled = !state.keyLocked;
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
  elements.beatIndicator.innerHTML = Array.from({ length: groove.beatsPerBar }, (_, index) => (
    `<div class="beat-dot${index === activeBeat ? ' active' : ''}" aria-label="Beat ${index + 1}"></div>`
  )).join('');
}

function updateStatusLine() {
  elements.currentKeyLabel.textContent = state.progression
    ? formatKeyLabel(state.progression.keyRoot, state.progression.mode)
    : 'Unavailable';
  elements.shapeModeLabel.textContent = state.shapeMode === 'best-fit' ? 'Best Fit' : 'Canonical';
}

function updateWarning(message) {
  elements.warning.textContent = message || '';
}

function updateTransportButton(isPlaying) {
  elements.transportButton.textContent = isPlaying ? 'Stop' : 'Play';
  elements.transportButton.setAttribute('aria-pressed', String(isPlaying));
}

function renderEmptyProgression(message) {
  elements.progressionMeta.textContent = message;
  elements.progressionGrid.innerHTML = `
    <article class="chord-card">
      <h3>—</h3>
      <div class="card-meta"><span class="theory-chip">No playable loop</span></div>
      <div class="diagram-wrap"></div>
      <button class="swap-shape" type="button" disabled>Adjust filters</button>
    </article>
  `;
}

function renderProgression() {
  if (!state.progression || !state.progression.chords?.length) {
    renderEmptyProgression('Choose more shape categories to create a loop.');
    updateStatusLine();
    return;
  }

  const selectedShapes = selectShapeSequence(
    state.progression.chords,
    chordLibrary,
    state.enabledCategories,
    state.shapeMode,
    state.shapeOverrides
  );

  if (!selectedShapes) {
    updateWarning('The selected shape filters cannot voice the current loop. Generate a new one.');
    renderEmptyProgression('Current loop is not playable with these filters.');
    updateStatusLine();
    return;
  }

  elements.progressionMeta.textContent = `${formatKeyLabel(state.progression.keyRoot, state.progression.mode)} • ${state.progression.templateId.replaceAll('-', ' ')}`;
  elements.progressionGrid.innerHTML = state.progression.chords.map((chord, index) => {
    const shape = selectedShapes.selected[index];
    const totalCandidates = selectedShapes.candidatesByIndex[index].length;
    return `
      <article class="chord-card" data-chord-card="${index}">
        <div class="card-topline">
          <div>
            <h3>${chord.label}</h3>
          </div>
          <span class="voicing-chip">${shape.label}</span>
        </div>
        <div class="card-meta">
          <span class="theory-chip">${chord.theoryChip}</span>
        </div>
        <div class="diagram-wrap">${renderChordDiagram(shape, { leftHanded: state.leftHanded })}</div>
        <button
          class="swap-shape"
          type="button"
          data-cycle-shape="${index}"
          ${totalCandidates < 2 ? 'disabled' : ''}
        >
          ${totalCandidates < 2 ? 'Only voicing' : `Swap shape (${selectedShapes.selectedIndices[index] + 1}/${totalCandidates})`}
        </button>
      </article>
    `;
  }).join('');

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

function readEnabledCategories() {
  state.enabledCategories = new Set(
    Array.from(document.querySelectorAll('input[name="shape-category"]:checked')).map((node) => node.value)
  );
}

function attachEventListeners() {
  elements.generateButton.addEventListener('click', regenerateProgression);
  elements.keyLockToggle.addEventListener('change', () => {
    state.keyLocked = elements.keyLockToggle.checked;
    elements.keyRootSelect.disabled = !state.keyLocked;
    regenerateProgression();
  });

  elements.keyRootSelect.addEventListener('change', () => {
    state.keyRoot = Number(elements.keyRootSelect.value);
    regenerateProgression();
  });

  document.querySelectorAll('input[name="mode-preference"]').forEach((node) => {
    node.addEventListener('change', () => {
      state.modePreference = document.querySelector('input[name="mode-preference"]:checked').value;
      regenerateProgression();
    });
  });

  document.querySelectorAll('input[name="shape-category"]').forEach((node) => {
    node.addEventListener('change', () => {
      readEnabledCategories();
      regenerateProgression();
    });
  });

  document.querySelectorAll('input[name="shape-mode"]').forEach((node) => {
    node.addEventListener('change', () => {
      state.shapeMode = document.querySelector('input[name="shape-mode"]:checked').value;
      renderProgression();
    });
  });

  elements.leftHandedToggle.addEventListener('change', () => {
    state.leftHanded = elements.leftHandedToggle.checked;
    renderProgression();
  });

  elements.progressionGrid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-cycle-shape]');
    if (!button || !state.progression) return;
    const index = Number(button.getAttribute('data-cycle-shape'));
    const selection = selectShapeSequence(
      state.progression.chords,
      chordLibrary,
      state.enabledCategories,
      state.shapeMode,
      state.shapeOverrides
    );
    if (!selection) return;
    const total = selection.candidatesByIndex[index].length;
    const currentIndex = selection.selectedIndices[index];
    state.shapeOverrides[index] = (currentIndex + 1) % total;
    renderProgression();
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
  attachEventListeners();
  chordLibrary = await loadChordLibrary();
  regenerateProgression();
}

init().catch((error) => {
  updateWarning('Failed to load chord data.');
  renderEmptyProgression('Reload the page to try again.');
  console.error(error);
});
