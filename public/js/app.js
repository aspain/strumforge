import { AudioEngine, GROOVES } from './audio-engine.js';
import { loadChordLibrary, selectShapeSequence } from './chord-library.js';
import { renderChordDiagram } from './chord-diagram.js';
import { getKeyTonicName, listPitchClasses } from './music-theory.js';
import { moveIndex, moveIndexedValues, moveItem } from './reorder-utils.js';
import {
  generateProgression,
  rebuildProgression,
  getFeasibleKeyRoots,
  NO_PLAYABLE_LOOP_WARNING
} from './progression-engine.js';

const state = {
  keyRoot: null,
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
  shapeOverrides: {},
  pendingHandleFocusIndex: null
};

const elements = {
  currentKeyLabel: document.getElementById('current-key-label'),
  beatCounterLabel: document.getElementById('beat-counter-label'),
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
let reorderStatus;
let dragSession = null;
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
  return `${getKeyTonicName(mode, root)} ${mode === 'major' ? 'major' : 'minor'}`;
}

function formatKeyRootOption(pitchClass) {
  if (state.modePreference === 'major' || state.modePreference === 'minor') {
    return getKeyTonicName(state.modePreference, pitchClass);
  }

  const majorName = getKeyTonicName('major', pitchClass);
  const minorName = getKeyTonicName('minor', pitchClass);
  return majorName === minorName ? majorName : `${majorName}/${minorName}`;
}

function renderKeyOptions() {
  const feasibleRoots = chordLibrary ? getFeasibleKeyRoots(state, chordLibrary) : listPitchClasses();
  if (state.keyRoot !== null && !feasibleRoots.includes(state.keyRoot)) {
    state.keyRoot = null;
  }

  elements.keyRootSelect.innerHTML = [
    '<option value="random">Random</option>',
    ...feasibleRoots.map((index) => `<option value="${index}">${formatKeyRootOption(index)}</option>`)
  ].join('');
  elements.keyRootSelect.value = state.keyRoot === null ? 'random' : String(state.keyRoot);
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

function ensureReorderStatusRegion() {
  if (reorderStatus) return reorderStatus;

  reorderStatus = document.createElement('div');
  reorderStatus.className = 'sr-only';
  reorderStatus.setAttribute('aria-live', 'polite');
  reorderStatus.setAttribute('aria-atomic', 'true');
  document.body.append(reorderStatus);
  return reorderStatus;
}

function announceReorder(message) {
  const liveRegion = ensureReorderStatusRegion();
  liveRegion.textContent = '';
  window.setTimeout(() => {
    liveRegion.textContent = message;
  }, 0);
}

function focusPendingHandle() {
  if (!Number.isInteger(state.pendingHandleFocusIndex)) return;
  const index = state.pendingHandleFocusIndex;
  state.pendingHandleFocusIndex = null;
  const handle = elements.progressionGrid.querySelector(`[data-reorder-handle="${index}"]`);
  if (handle) {
    window.requestAnimationFrame(() => handle.focus());
  }
}

function moveChord(fromIndex, toIndex, { focusHandle = false, announceMove = false } = {}) {
  if (!state.progression?.chords?.length) return;
  if (fromIndex === toIndex) return;
  if (
    fromIndex < 0
    || toIndex < 0
    || fromIndex >= state.progression.chords.length
    || toIndex >= state.progression.chords.length
  ) {
    return;
  }

  const movedChord = state.progression.chords[fromIndex];
  state.progression = {
    ...state.progression,
    chords: moveItem(state.progression.chords, fromIndex, toIndex)
  };
  state.shapeOverrides = moveIndexedValues(
    state.shapeOverrides,
    state.progression.chords.length,
    fromIndex,
    toIndex
  );
  state.activeChordIndex = moveIndex(state.activeChordIndex, fromIndex, toIndex);

  if (focusHandle) {
    state.pendingHandleFocusIndex = toIndex;
  }

  renderProgression();

  if (announceMove) {
    announceReorder(`Moved ${movedChord.label} to position ${toIndex + 1} of ${state.progression.chords.length}.`);
  }
}

function captureCardPositions(excludedCard = null) {
  return new Map(
    Array.from(elements.progressionGrid.querySelectorAll('[data-chord-card]'))
      .filter((card) => card !== excludedCard)
      .map((card) => [card, card.getBoundingClientRect()])
  );
}

function animateCardReflow(previousRects) {
  if (!previousRects?.size) return;

  Array.from(elements.progressionGrid.querySelectorAll('[data-chord-card]')).forEach((card) => {
    const previousRect = previousRects.get(card);
    if (!previousRect) return;

    const nextRect = card.getBoundingClientRect();
    const deltaX = previousRect.left - nextRect.left;
    const deltaY = previousRect.top - nextRect.top;
    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;

    card.style.setProperty('--card-translate-x', `${deltaX}px`);
    card.style.setProperty('--card-translate-y', `${deltaY}px`);
    card.getBoundingClientRect();

    window.requestAnimationFrame(() => {
      card.style.setProperty('--card-translate-x', '0px');
      card.style.setProperty('--card-translate-y', '0px');
    });
  });
}

function buildCardRows(cards) {
  const rows = [];

  cards.forEach((card, index) => {
    const rect = card.getBoundingClientRect();
    const rowTolerance = Math.max(12, rect.height * 0.22);
    const previousRow = rows[rows.length - 1];

    if (previousRow && Math.abs(previousRow.top - rect.top) <= rowTolerance) {
      previousRow.items.push({
        card,
        rect,
        insertionIndex: index
      });
      previousRow.bottom = Math.max(previousRow.bottom, rect.bottom);
      previousRow.centerY = (previousRow.top + previousRow.bottom) / 2;
      return;
    }

    rows.push({
      top: rect.top,
      bottom: rect.bottom,
      centerY: rect.top + rect.height / 2,
      items: [
        {
          card,
          rect,
          insertionIndex: index
        }
      ]
    });
  });

  return rows;
}

function findClosestRow(rows, pointerY) {
  if (pointerY <= rows[0].top) return rows[0];
  if (pointerY >= rows[rows.length - 1].bottom) return rows[rows.length - 1];

  return rows.reduce((bestRow, row) => {
    if (pointerY >= row.top && pointerY <= row.bottom) return row;
    if (!bestRow) return row;

    const currentDistance = Math.abs(pointerY - row.centerY);
    const bestDistance = Math.abs(pointerY - bestRow.centerY);
    return currentDistance < bestDistance ? row : bestRow;
  }, null);
}

function getGhostMetrics(session) {
  const left = session.currentX - session.offsetX;
  const top = session.currentY - session.offsetY;
  const width = session.cardWidth;
  const height = session.cardHeight;

  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    centerX: left + width / 2,
    centerY: top + height / 2
  };
}

function getNearestInsertionIndex(ghostMetrics, placeholderCard) {
  const siblingCards = Array.from(elements.progressionGrid.querySelectorAll('[data-chord-card]'))
    .filter((card) => card !== placeholderCard);
  if (!siblingCards.length) return 0;

  const rows = buildCardRows(siblingCards);
  const activeRow = findClosestRow(rows, ghostMetrics.centerY);
  if (!activeRow) return 0;

  if (activeRow.items.length === 1) {
    const [{ rect, insertionIndex }] = activeRow.items;
    return ghostMetrics.centerX < rect.left + rect.width / 2 ? insertionIndex : insertionIndex + 1;
  }

  for (const item of activeRow.items) {
    const midpoint = item.rect.left + item.rect.width / 2;
    if (ghostMetrics.centerX < midpoint) {
      return item.insertionIndex;
    }
  }

  return activeRow.items[activeRow.items.length - 1].insertionIndex + 1;
}

function positionDragGhost(session) {
  if (!session?.ghost) return;
  session.ghost.style.left = `${session.currentX - session.offsetX}px`;
  session.ghost.style.top = `${session.currentY - session.offsetY}px`;
}

function updateDragPlaceholder(session) {
  if (!session?.activated || !session.placeholderCard) return;

  const nextIndex = getNearestInsertionIndex(getGhostMetrics(session), session.placeholderCard);
  if (nextIndex === session.targetIndex) return;
  session.targetIndex = nextIndex;

  const previousRects = captureCardPositions(session.placeholderCard);
  const siblings = Array.from(elements.progressionGrid.querySelectorAll('[data-chord-card]'))
    .filter((card) => card !== session.placeholderCard);
  const nextSibling = siblings[nextIndex] ?? null;
  elements.progressionGrid.insertBefore(session.placeholderCard, nextSibling);
  animateCardReflow(previousRects);
}

function activateDragSession(session) {
  if (!session || session.activated) return;
  session.activated = true;
  session.handle.classList.add('dragging');
  document.body.classList.add('is-reordering');

  const rect = session.placeholderCard.getBoundingClientRect();
  session.offsetX = session.currentX - rect.left;
  session.offsetY = session.currentY - rect.top;
  session.cardWidth = rect.width;
  session.cardHeight = rect.height;
  session.targetIndex = session.sourceIndex;

  session.ghost = session.placeholderCard.cloneNode(true);
  session.ghost.classList.add('drag-ghost');
  session.ghost.removeAttribute('data-chord-card');
  session.ghost.setAttribute('aria-hidden', 'true');
  session.ghost.style.width = `${rect.width}px`;
  session.ghost.style.height = `${rect.height}px`;
  document.body.append(session.ghost);

  session.placeholderCard.classList.add('drag-placeholder');
  announceReorder(`Reordering ${session.label}. Move to a new position, then release.`);
  positionDragGhost(session);
}

function clearPendingDrag(session) {
  if (session?.holdTimer) {
    window.clearTimeout(session.holdTimer);
    session.holdTimer = null;
  }
}

function cleanupDragSession(session) {
  clearPendingDrag(session);
  if (!session) return;
  session.handle.classList.remove('dragging');
  document.body.classList.remove('is-reordering');
  session.placeholderCard.classList.remove('drag-placeholder');
  session.ghost?.remove();
  try {
    session.handle.releasePointerCapture(session.pointerId);
  } catch {
    // Pointer capture may already be released.
  }
  window.removeEventListener('pointermove', handlePointerMove);
  window.removeEventListener('pointerup', handlePointerEnd);
  window.removeEventListener('pointercancel', handlePointerEnd);
  dragSession = null;
}

function handlePointerMove(event) {
  if (!dragSession || event.pointerId !== dragSession.pointerId) return;
  dragSession.currentX = event.clientX;
  dragSession.currentY = event.clientY;

  if (!dragSession.activated) {
    const movedTooFar = Math.hypot(
      dragSession.currentX - dragSession.startX,
      dragSession.currentY - dragSession.startY
    ) > 10;

    if (dragSession.pointerType !== 'mouse' && movedTooFar) {
      cleanupDragSession(dragSession);
    }
    return;
  }

  event.preventDefault();
  positionDragGhost(dragSession);
  updateDragPlaceholder(dragSession);
}

function handlePointerEnd(event) {
  if (!dragSession || event.pointerId !== dragSession.pointerId) return;

  const completedSession = dragSession;
  const wasActivated = completedSession.activated;
  const fromIndex = completedSession.sourceIndex;
  const toIndex = completedSession.targetIndex;
  cleanupDragSession(completedSession);

  if (wasActivated && fromIndex !== toIndex) {
    moveChord(fromIndex, toIndex, {
      focusHandle: true,
      announceMove: true
    });
  }
}

function beginPointerReorder(event, handle) {
  if (!state.progression?.chords?.length || state.progression.chords.length < 2) return;
  const card = handle.closest('[data-chord-card]');
  if (!card) return;

  if (dragSession) {
    cleanupDragSession(dragSession);
  }

  const sourceIndex = Number(card.getAttribute('data-chord-card'));
  const pointerType = event.pointerType || 'mouse';
  const session = {
    pointerId: event.pointerId,
    pointerType,
    sourceIndex,
    targetIndex: sourceIndex,
    label: state.progression.chords[sourceIndex].label,
    handle,
    placeholderCard: card,
    ghost: null,
    activated: false,
    holdTimer: null,
    startX: event.clientX,
    startY: event.clientY,
    currentX: event.clientX,
    currentY: event.clientY,
    offsetX: 0,
    offsetY: 0,
    cardWidth: 0,
    cardHeight: 0
  };

  dragSession = session;
  handle.setPointerCapture(event.pointerId);
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerEnd);
  window.addEventListener('pointercancel', handlePointerEnd);
  event.preventDefault();

  if (pointerType === 'mouse') {
    activateDragSession(session);
    return;
  }

  session.holdTimer = window.setTimeout(() => {
    activateDragSession(session);
  }, 180);
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
    <strong class="progression-key-title">${formatKeyLabel(state.progression.keyRoot, state.progression.mode)}</strong>
  `;
  elements.progressionGrid.innerHTML = state.progression.chords.map((chord, index) => {
    const shape = selectedShapes.selected[index];
    const totalCandidates = selectedShapes.candidatesByIndex[index].length;
    return `
      <article class="chord-card${index === state.activeChordIndex && state.playChords ? ' playing' : ''}" data-chord-card="${index}">
        <div class="card-header">
          <div class="card-chip-row">
            <span class="theory-chip card-chip-inline">${chord.theoryChip}</span>
            <span class="voicing-chip card-chip-inline">${shape.label}</span>
          </div>
          <h3>${chord.label}</h3>
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
        <button
          class="reorder-handle"
          type="button"
          data-reorder-handle="${index}"
          aria-label="Reorder ${chord.label}"
          title="Drag to reorder"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <circle cx="5" cy="4" r="1.2"></circle>
            <circle cx="11" cy="4" r="1.2"></circle>
            <circle cx="5" cy="8" r="1.2"></circle>
            <circle cx="11" cy="8" r="1.2"></circle>
            <circle cx="5" cy="12" r="1.2"></circle>
            <circle cx="11" cy="12" r="1.2"></circle>
          </svg>
        </button>
      </article>
    `;
  }).join('');

  setActiveChord(state.activeChordIndex);
  updateStatusLine();
  focusPendingHandle();
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
  elements.keyRootSelect.addEventListener('change', () => {
    state.keyRoot = elements.keyRootSelect.value === 'random'
      ? null
      : Number(elements.keyRootSelect.value);
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

  elements.progressionGrid.addEventListener('pointerdown', (event) => {
    const handle = event.target.closest('[data-reorder-handle]');
    if (!handle) return;
    beginPointerReorder(event, handle);
  });

  elements.progressionGrid.addEventListener('keydown', (event) => {
    const handle = event.target.closest('[data-reorder-handle]');
    if (!handle || !state.progression?.chords?.length) return;

    const index = Number(handle.getAttribute('data-reorder-handle'));
    const lastIndex = state.progression.chords.length - 1;
    let nextIndex = index;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = Math.max(0, index - 1);
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = Math.min(lastIndex, index + 1);
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = lastIndex;
        break;
      default:
        return;
    }

    event.preventDefault();
    if (nextIndex === index) return;
    moveChord(index, nextIndex, {
      focusHandle: true,
      announceMove: true
    });
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
  ensureReorderStatusRegion();
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
