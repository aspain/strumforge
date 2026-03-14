import { AudioEngine, GROOVES } from './audio-engine.js';
import { loadChordLibrary, selectShapeSequence } from './chord-library.js';
import { renderChordDiagram } from './chord-diagram.js';
import { getDiagramZoomStartIndex } from './diagram-zoom.js';
import { getKeyTonicName, listPitchClasses } from './music-theory.js';
import { moveIndex, moveIndexedValues, moveItem } from './reorder-utils.js';
import { setScreenWakeEnabled } from './screen-wake.js';
import { parseCommittedTempo, parseTempoDraft } from './tempo-utils.js';
import {
  generateDistinctProgression,
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
  groove: 'groove-44-1',
  playDrums: true,
  playChords: false,
  activeChordIndex: -1,
  zoomedChordIndex: null,
  progression: null,
  warningMessage: '',
  shapeOverrides: {},
  pendingHandleFocusIndex: null,
  audioPrimed: false
};

const elements = {
  currentKeyLabel: document.getElementById('current-key-label'),
  beatCounterLabel: document.getElementById('beat-counter-label'),
  keyRootSelect: document.getElementById('key-root-select'),
  leftHandedToggle: document.getElementById('left-handed-toggle'),
  controlActionsSlot: document.getElementById('control-actions-slot'),
  actionControls: document.getElementById('primary-action-controls'),
  generateButton: document.getElementById('generate-button'),
  progressionKeyDisplay: document.getElementById('progression-key-display'),
  progressionGrid: document.getElementById('progression-grid'),
  diagramZoomOverlay: document.getElementById('diagram-zoom-overlay'),
  diagramZoomSheet: document.querySelector('.diagram-zoom-sheet'),
  diagramZoomTitle: document.getElementById('diagram-zoom-title'),
  diagramZoomViewport: document.getElementById('diagram-zoom-viewport'),
  diagramZoomBody: document.getElementById('diagram-zoom-body'),
  diagramZoomCloseButton: document.querySelector('.diagram-zoom-close'),
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
let diagramZoomTrigger = null;
let diagramZoomGestureSession = null;
let diagramZoomStepTimer = null;
const compactActionControlsQuery = typeof window.matchMedia === 'function'
  ? window.matchMedia('(max-width: 1040px)')
  : null;
const narrowActionControlsQuery = typeof window.matchMedia === 'function'
  ? window.matchMedia('(max-width: 620px)')
  : null;
const touchInputQuery = typeof window.matchMedia === 'function'
  ? window.matchMedia('(hover: none), (pointer: coarse)')
  : null;
const audioEngine = new AudioEngine(({ beatIndex, chordIndex }) => {
  renderBeatPulse(beatIndex);
  setActiveChord(chordIndex);
});

function isNativeShell() {
  return window.location.protocol === 'capacitor:' || document.URL.startsWith('capacitor://');
}

function applyPlatformClassNames() {
  const nativeShell = isNativeShell();
  document.documentElement.classList.toggle('is-native-app', nativeShell);
  document.body.classList.toggle('is-native-app', nativeShell);
}

function blurSelectAfterCommit(select) {
  if (!(select instanceof HTMLSelectElement)) return;
  if (!isNativeShell() && !touchInputQuery?.matches) return;

  window.setTimeout(() => {
    if (document.activeElement === select) {
      select.blur();
    }
  }, 0);
}

async function primeAudio() {
  if (state.audioPrimed) return;
  try {
    await audioEngine.prime();
    state.audioPrimed = true;
  } catch (error) {
    console.warn('Audio priming failed.', error);
  }
}

function installAudioPrimer() {
  const handleFirstGesture = () => {
    document.removeEventListener('keydown', handleFirstGesture);
    void primeAudio();
  };

  document.addEventListener('pointerdown', handleFirstGesture, {
    once: true,
    passive: true
  });
  document.addEventListener('keydown', handleFirstGesture, { once: true });
}

function installTooltipDismissal() {
  document.addEventListener('pointerdown', (event) => {
    const target = event.target;
    if (!(target instanceof Element) || target.closest('.field-help')) {
      return;
    }

    const openHelp = document.activeElement;
    if (openHelp instanceof HTMLElement && openHelp.classList.contains('field-help')) {
      openHelp.blur();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;

    const openHelp = document.activeElement;
    if (openHelp instanceof HTMLElement && openHelp.classList.contains('field-help')) {
      openHelp.blur();
    }
  });
}

function installSelectionSuppression() {
  const blockSelection = (event) => {
    if (document.body.classList.contains('is-reordering')) {
      event.preventDefault();
    }
  };

  document.addEventListener('selectstart', blockSelection);
  document.addEventListener('dragstart', blockSelection);
}

function getProgressionHeaderActionsSlot() {
  return elements.progressionKeyDisplay?.querySelector('[data-progression-header-actions]');
}

function syncPrimaryActionSlotVisibility() {
  if (elements.controlActionsSlot) {
    elements.controlActionsSlot.hidden = !elements.controlActionsSlot.contains(elements.actionControls);
  }
}

function syncPrimaryActionControlsPlacement() {
  const headerActionsSlot = getProgressionHeaderActionsSlot();
  const targetSlot = compactActionControlsQuery?.matches && headerActionsSlot
    ? headerActionsSlot
    : elements.controlActionsSlot;
  if (!targetSlot) {
    syncPrimaryActionSlotVisibility();
    return;
  }

  if (elements.actionControls.parentElement !== targetSlot) {
    targetSlot.append(elements.actionControls);
  }

  syncPrimaryActionSlotVisibility();
}

function installActionControlsLayoutSync() {
  syncPrimaryActionControlsPlacement();
  if (!compactActionControlsQuery) return;

  const handleChange = () => {
    syncPrimaryActionControlsPlacement();
    syncProgressionHeaderActionsLayout();
  };
  if (typeof compactActionControlsQuery.addEventListener === 'function') {
    compactActionControlsQuery.addEventListener('change', handleChange);
    return;
  }

  if (typeof compactActionControlsQuery.addListener === 'function') {
    compactActionControlsQuery.addListener(handleChange);
  }
}

function clearDiagramZoomStepTimer() {
  if (diagramZoomStepTimer) {
    window.clearTimeout(diagramZoomStepTimer);
    diagramZoomStepTimer = null;
  }
}

function getWrappedZoomIndex(index, offset, total = state.progression?.chords?.length ?? 0) {
  if (!total) return index;
  return (index + offset + total) % total;
}

function setDiagramZoomOffsets({ x = 0, sheetY = 0, trackBase = '-33.333333%' } = {}) {
  elements.diagramZoomOverlay.style.setProperty('--diagram-zoom-translate-x', `${x}px`);
  elements.diagramZoomOverlay.style.setProperty('--diagram-zoom-sheet-translate-y', `${sheetY}px`);
  elements.diagramZoomOverlay.style.setProperty('--diagram-zoom-track-base', trackBase);
  elements.diagramZoomOverlay.style.setProperty(
    '--diagram-zoom-backdrop-opacity',
    String(Math.max(0.32, 1 - Math.abs(sheetY) / 220))
  );
}

function renderZoomTrack(selection, centerIndex) {
  const total = state.progression?.chords?.length ?? 0;
  if (!total) return '';

  return [-1, 0, 1].map((offset, slideIndex) => {
    const chordIndex = getWrappedZoomIndex(centerIndex, offset, total);
    const chord = state.progression.chords[chordIndex];
    const shape = selection.selected[chordIndex];
    const isCurrent = slideIndex === 1;
    return `
      <div class="diagram-zoom-slide${isCurrent ? ' is-current' : ''}"${isCurrent ? '' : ' aria-hidden="true" inert'}>
        ${renderChordCardMarkup(chord, shape, {
          index: chordIndex,
          selectedIndex: selection.selectedIndices[chordIndex],
          totalCandidates: selection.candidatesByIndex[chordIndex].length,
          preferredIndex: selection.preferredIndices[chordIndex],
          context: 'zoom'
        })}
      </div>
    `;
  }).join('');
}

function finalizeAnimatedZoomStep(nextIndex) {
  clearDiagramZoomStepTimer();
  state.zoomedChordIndex = nextIndex;
  elements.diagramZoomBody.classList.add('gesture-active');
  syncDiagramZoom();
  window.requestAnimationFrame(() => {
    elements.diagramZoomBody.classList.remove('gesture-active');
  });
}

function animateZoomStep(direction, targetIndex = getWrappedZoomIndex(state.zoomedChordIndex, direction)) {
  if (!Number.isInteger(direction) || direction === 0 || state.zoomedChordIndex === null) return;
  if (diagramZoomStepTimer) return;

  clearDiagramZoomStepTimer();
  elements.diagramZoomBody.classList.remove('gesture-active');
  setDiagramZoomOffsets({
    x: 0,
    sheetY: 0,
    trackBase: direction > 0 ? '-66.666667%' : '0%'
  });
  diagramZoomStepTimer = window.setTimeout(() => finalizeAnimatedZoomStep(targetIndex), 220);
}

function stepZoom(offset, { animate = true } = {}) {
  const total = state.progression?.chords?.length ?? 0;
  if (!total || state.zoomedChordIndex === null) return;
  const direction = offset > 0 ? 1 : -1;
  const nextIndex = getWrappedZoomIndex(state.zoomedChordIndex, direction, total);
  if (!animate) {
    state.zoomedChordIndex = nextIndex;
    syncDiagramZoom();
    return;
  }

  animateZoomStep(direction, nextIndex);
}

function syncDiagramZoom({ focusCloseButton = false } = {}) {
  if (state.zoomedChordIndex === null) return;

  const selection = getSelectedShapes();
  const chord = state.progression?.chords?.[state.zoomedChordIndex];
  const shape = selection?.selected?.[state.zoomedChordIndex];
  if (!chord || !shape) {
    closeDiagramZoom({ restoreFocus: false });
    return;
  }

  elements.diagramZoomTitle.textContent = `${chord.label} chord details`;
  elements.diagramZoomBody.innerHTML = renderZoomTrack(selection, state.zoomedChordIndex);
  elements.diagramZoomOverlay.hidden = false;
  document.body.classList.add('diagram-zoom-open');
  setDiagramZoomOffsets();
  setActiveChord(state.activeChordIndex, { syncZoom: false });

  if (focusCloseButton) {
    window.requestAnimationFrame(() => {
      elements.diagramZoomCloseButton?.focus({ preventScroll: true });
    });
  }
}

function closeDiagramZoom({ restoreFocus = true } = {}) {
  if (state.zoomedChordIndex === null && elements.diagramZoomOverlay.hidden) return;

  state.zoomedChordIndex = null;
  diagramZoomGestureSession = null;
  clearDiagramZoomStepTimer();
  elements.diagramZoomOverlay.hidden = true;
  elements.diagramZoomBody.innerHTML = '';
  elements.diagramZoomBody.classList.remove('gesture-active');
  elements.diagramZoomSheet.classList.remove('gesture-active');
  document.body.classList.remove('diagram-zoom-open');
  setDiagramZoomOffsets();

  if (restoreFocus && diagramZoomTrigger?.isConnected) {
    diagramZoomTrigger.focus({ preventScroll: true });
  }

  diagramZoomTrigger = null;
}

function openDiagramZoom(index, trigger) {
  const startIndex = getDiagramZoomStartIndex(index, {
    playChords: state.playChords,
    isPlaying: audioEngine.isPlaying,
    activeChordIndex: state.activeChordIndex
  });
  if (startIndex === null) return;

  state.zoomedChordIndex = startIndex;
  diagramZoomTrigger = trigger instanceof HTMLElement ? trigger : null;
  syncDiagramZoom({ focusCloseButton: true });
}

function installDiagramZoomInteractions() {
  elements.diagramZoomOverlay.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target === elements.diagramZoomOverlay || target.closest('[data-close-diagram-zoom]')) {
      closeDiagramZoom();
      return;
    }

    const navButton = target.closest('[data-zoom-nav]');
    if (navButton) {
      stepZoom(Number(navButton.getAttribute('data-zoom-nav')) || 0);
    }
  });

  elements.diagramZoomBody.addEventListener('click', (event) => {
    const previewButton = event.target.closest('[data-preview-chord]');
    if (previewButton) {
      previewChord(Number(previewButton.getAttribute('data-preview-chord')));
      return;
    }

    const swapButton = event.target.closest('[data-cycle-shape]');
    if (swapButton) {
      cycleShape(Number(swapButton.getAttribute('data-cycle-shape')));
    }
  });

  document.addEventListener('keydown', (event) => {
    if (elements.diagramZoomOverlay.hidden) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeDiagramZoom();
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      stepZoom(-1);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      stepZoom(1);
    }
  });

  elements.diagramZoomViewport.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    const target = event.target;
    if (target instanceof Element && target.closest('button')) return;

    diagramZoomGestureSession = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      axis: null
    };
    elements.diagramZoomBody.classList.add('gesture-active');
    elements.diagramZoomSheet.classList.add('gesture-active');
    elements.diagramZoomViewport.setPointerCapture(event.pointerId);
  });

  elements.diagramZoomViewport.addEventListener('pointermove', (event) => {
    if (
      event.pointerType !== 'touch'
      || !diagramZoomGestureSession
      || event.pointerId !== diagramZoomGestureSession.pointerId
    ) {
      return;
    }

    const deltaX = event.clientX - diagramZoomGestureSession.startX;
    const deltaY = event.clientY - diagramZoomGestureSession.startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!diagramZoomGestureSession.axis) {
      if (Math.max(absX, absY) < 8) return;
      if (absX > absY * 1.1) {
        diagramZoomGestureSession.axis = 'horizontal';
      } else if (absY > absX * 1.1) {
        diagramZoomGestureSession.axis = 'vertical';
      } else {
        return;
      }
    }

    if (diagramZoomGestureSession.axis === 'horizontal') {
      setDiagramZoomOffsets({ x: deltaX, trackBase: '-33.333333%' });
      return;
    }

    setDiagramZoomOffsets({ sheetY: deltaY });
  });

  const finishDiagramZoomGesture = (event) => {
    if (!diagramZoomGestureSession || event.pointerId !== diagramZoomGestureSession.pointerId) return;

    if (elements.diagramZoomViewport.hasPointerCapture(event.pointerId)) {
      elements.diagramZoomViewport.releasePointerCapture(event.pointerId);
    }

    const deltaX = event.clientX - diagramZoomGestureSession.startX;
    const deltaY = event.clientY - diagramZoomGestureSession.startY;
    const axis = diagramZoomGestureSession.axis;
    diagramZoomGestureSession = null;
    elements.diagramZoomBody.classList.remove('gesture-active');
    elements.diagramZoomSheet.classList.remove('gesture-active');

    if (axis === 'horizontal' && Math.abs(deltaX) > 72) {
      stepZoom(deltaX < 0 ? 1 : -1);
      return;
    }

    if (axis === 'vertical' && Math.abs(deltaY) > 88) {
      closeDiagramZoom();
      return;
    }

    setDiagramZoomOffsets();
  };

  elements.diagramZoomViewport.addEventListener('pointerup', finishDiagramZoomGesture);
  elements.diagramZoomViewport.addEventListener('pointercancel', finishDiagramZoomGesture);
}

function pauseTransportForBackground() {
  const didPause = audioEngine.pauseForBackground();
  if (didPause) {
    updateTransportButton(false);
  }
}

async function restoreTransportAfterBackground() {
  if (document.hidden) return;
  const resumed = await audioEngine.restoreAfterBackground();
  if (resumed) {
    updateTransportButton(true);
  }
}

function attachLifecycleListeners() {
  const appPlugin = window.Capacitor?.Plugins?.App;

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseTransportForBackground();
      return;
    }

    void restoreTransportAfterBackground();
  });

  window.addEventListener('pagehide', pauseTransportForBackground);

  if (typeof appPlugin?.addListener === 'function') {
    appPlugin.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void restoreTransportAfterBackground();
        return;
      }

      pauseTransportForBackground();
    });
  }
}

function syncTransportMode() {
  audioEngine.setTransportMode({ drums: state.playDrums, chords: state.playChords });
  document.querySelectorAll('[data-transport-toggle="drums"]').forEach((toggle) => {
    toggle.checked = state.playDrums;
  });
  document.querySelectorAll('[data-transport-toggle="chords"]').forEach((toggle) => {
    toggle.checked = state.playChords;
  });
  document.querySelectorAll('[data-transport-button]').forEach((button) => {
    button.disabled = !state.playDrums && !state.playChords;
  });
  if (!state.playChords) setActiveChord(-1);
  syncProgressionHeaderActionsLayout();
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
    .map((groove) => `<option value="${groove.id}"${groove.id === state.groove ? ' selected' : ''}>${groove.label}</option>`)
    .join('');
  elements.grooveSelect.value = state.groove;
  const groove = GROOVES.find((item) => item.id === state.groove);
  elements.grooveLabel.textContent = groove.label;
  audioEngine.setGroove(state.groove);
  renderBeatPulse(-1);
}

function syncRhythmControlsFromState() {
  elements.meterSelect.value = state.meter;
  renderGrooveOptions();
}

function syncProgressionHeaderActionsLayout() {
  const header = elements.progressionKeyDisplay?.querySelector('.progression-key-header');
  const title = header?.querySelector('.progression-key-title');
  const actionsSlot = getProgressionHeaderActionsSlot();
  const controls = actionsSlot?.querySelector('.primary-action-controls');
  if (!(header instanceof HTMLElement) || !(title instanceof HTMLElement) || !(actionsSlot instanceof HTMLElement)) {
    return;
  }

  if (!(controls instanceof HTMLElement)) {
    header.style.removeProperty('--progression-header-actions-left');
    header.style.removeProperty('--progression-header-title-max');
    return;
  }

  if (window.getComputedStyle(actionsSlot).display === 'none') {
    header.style.removeProperty('--progression-header-actions-left');
    header.style.removeProperty('--progression-header-title-max');
    return;
  }

  const headerWidth = header.clientWidth;
  const actionsWidth = actionsSlot.offsetWidth;
  if (!headerWidth || !actionsWidth) return;

  const gap = 10;
  const maxLeft = Math.max(0, headerWidth - actionsWidth);
  const titleWidth = title.scrollWidth;
  const centeredLeft = Math.max(0, (headerWidth - actionsWidth) / 2);
  const minLeft = titleWidth + gap;
  const actionsLeft = narrowActionControlsQuery?.matches
    ? maxLeft
    : Math.min(Math.max(centeredLeft, minLeft), maxLeft);
  const titleMax = Math.max(0, actionsLeft - gap);

  header.style.setProperty('--progression-header-actions-left', `${actionsLeft}px`);
  header.style.setProperty('--progression-header-title-max', `${titleMax}px`);
}

function renderBeatPulse(activeBeat) {
  const groove = GROOVES.find((item) => item.id === state.groove);
  elements.beatCounterLabel.textContent = activeBeat >= 0 ? `Beat ${activeBeat + 1} of ${groove.beatsPerBar}` : '';
  elements.beatIndicator.innerHTML = Array.from({ length: groove.beatsPerBar }, (_, index) => (
    `<div class="beat-dot${index === activeBeat ? ' active' : ''}" aria-label="Beat ${index + 1}"></div>`
  )).join('');
}

function useCompactSwapShapeLabel() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1040px)').matches;
}

function getSwapShapeCyclePosition(selectedIndex, preferredIndex, totalCandidates) {
  if (totalCandidates < 1) return 0;
  const normalizedPreferredIndex = Number.isInteger(preferredIndex) ? preferredIndex : 0;
  return ((selectedIndex - normalizedPreferredIndex + totalCandidates) % totalCandidates) + 1;
}

function formatSwapShapeLabel(selectedIndex, totalCandidates, preferredIndex = 0) {
  if (totalCandidates < 2) return 'Only shape';
  const counter = `${getSwapShapeCyclePosition(selectedIndex, preferredIndex, totalCandidates)}/${totalCandidates}`;
  return useCompactSwapShapeLabel() ? `Swap (${counter})` : `Swap shape (${counter})`;
}

function renderChordCardMarkup(
  chord,
  shape,
  {
    index,
    selectedIndex,
    totalCandidates,
    preferredIndex,
    context = 'grid'
  }
) {
  const isZoomCard = context === 'zoom';
  const isPlaying = index === state.activeChordIndex && state.playChords;

  return `
    <article class="chord-card${isPlaying ? ' playing' : ''}${isZoomCard ? ' diagram-zoom-card' : ''}" data-chord-card="${index}">
      <div class="card-header">
        <div class="card-chip-row">
          <span class="theory-chip card-chip-inline">${chord.theoryChip}</span>
          <span class="voicing-chip card-chip-inline">${shape.label}</span>
        </div>
        <h3>${chord.label}</h3>
      </div>
      <div class="diagram-wrap">
        <div class="diagram-frame">
          ${renderChordDiagram(shape, { leftHanded: state.leftHanded })}
          ${isZoomCard ? '' : `
            <button
              class="diagram-zoom-button"
              type="button"
              data-zoom-diagram="${index}"
              aria-label="Enlarge ${chord.label} chord diagram"
              aria-haspopup="dialog"
              aria-controls="diagram-zoom-overlay"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <circle cx="8.25" cy="8.25" r="4.75"></circle>
                <path d="m11.8 11.8 4.2 4.2"></path>
              </svg>
            </button>
          `}
        </div>
      </div>
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
          ${formatSwapShapeLabel(selectedIndex, totalCandidates, preferredIndex)}
        </button>
      </div>
      ${isZoomCard ? '' : `
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
      `}
    </article>
  `;
}

function previewChord(index) {
  if (!state.progression || !Number.isInteger(index)) return;
  const selection = getSelectedShapes();
  if (selection?.selected[index]) {
    audioEngine.playChord(selection.selected[index]);
  }
}

function cycleShape(index) {
  if (!state.progression || !Number.isInteger(index)) return;
  const selection = getSelectedShapes();
  if (!selection) return;
  const total = selection.candidatesByIndex[index].length;
  const currentIndex = selection.selectedIndices[index];
  state.shapeOverrides[index] = (currentIndex + 1) % total;
  renderProgression();
}

function setActiveChord(index, { syncZoom = true } = {}) {
  state.activeChordIndex = Number.isInteger(index) ? index : -1;
  [elements.progressionGrid, elements.diagramZoomBody].forEach((root) => {
    root?.querySelectorAll('[data-chord-card]').forEach((card) => {
      const cardIndex = Number(card.getAttribute('data-chord-card'));
      card.classList.toggle('playing', cardIndex === state.activeChordIndex && state.playChords);
    });
  });

  if (
    syncZoom
    && state.zoomedChordIndex !== null
    && state.playChords
    && audioEngine.isPlaying
    && state.activeChordIndex >= 0
    && state.zoomedChordIndex !== state.activeChordIndex
  ) {
    const total = state.progression?.chords?.length ?? 0;
    const nextIndex = getWrappedZoomIndex(state.zoomedChordIndex, 1, total);
    const previousIndex = getWrappedZoomIndex(state.zoomedChordIndex, -1, total);
    if (state.activeChordIndex === nextIndex) {
      animateZoomStep(1, state.activeChordIndex);
      return;
    }
    if (state.activeChordIndex === previousIndex) {
      animateZoomStep(-1, state.activeChordIndex);
      return;
    }

    state.zoomedChordIndex = state.activeChordIndex;
    syncDiagramZoom();
  }
}

function updateStatusLine() {
  elements.currentKeyLabel.textContent = state.progression
    ? formatKeyLabel(state.progression.keyRoot, state.progression.mode)
    : 'Unavailable';
}

function updateWarning(message) {
  state.warningMessage = message || '';
}

function syncPlaybackScreenWake() {
  void setScreenWakeEnabled(audioEngine.isPlaying && !document.hidden);
}

function updateTransportButton(isPlaying) {
  document.querySelectorAll('[data-transport-button]').forEach((button) => {
    button.textContent = isPlaying ? 'Stop' : 'Play';
    button.setAttribute('aria-pressed', String(isPlaying));
  });
  syncPlaybackScreenWake();
  syncProgressionHeaderActionsLayout();
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
  if (completedSession.handle instanceof HTMLElement) {
    completedSession.handle.blur();
  }

  if (wasActivated && fromIndex !== toIndex) {
    moveChord(fromIndex, toIndex, {
      focusHandle: false,
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
  closeDiagramZoom({ restoreFocus: false });
  setActiveChord(-1);
  audioEngine.setChordSequence([]);
  elements.progressionKeyDisplay.innerHTML = '';
  elements.progressionKeyDisplay.classList.add('is-hidden');
  syncPrimaryActionControlsPlacement();
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
      title: state.warningMessage || NO_PLAYABLE_LOOP_WARNING
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
    <div class="progression-key-header">
      <strong class="progression-key-title">${formatKeyLabel(state.progression.keyRoot, state.progression.mode)}</strong>
      <div class="progression-header-actions" data-progression-header-actions></div>
    </div>
  `;
  syncPrimaryActionControlsPlacement();
  elements.progressionGrid.innerHTML = state.progression.chords.map((chord, index) => {
    const shape = selectedShapes.selected[index];
    return renderChordCardMarkup(chord, shape, {
      index,
      selectedIndex: selectedShapes.selectedIndices[index],
      totalCandidates: selectedShapes.candidatesByIndex[index].length,
      preferredIndex: selectedShapes.preferredIndices[index]
    });
  }).join('');

  setActiveChord(state.activeChordIndex, { syncZoom: false });
  syncDiagramZoom();
  syncTransportMode();
  updateTransportButton(audioEngine.isPlaying);
  updateStatusLine();
  focusPendingHandle();
  window.requestAnimationFrame(() => syncProgressionHeaderActionsLayout());
}

function regenerateProgression() {
  state.shapeOverrides = {};
  const result = generateDistinctProgression(state, chordLibrary, state.progression);
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
  const nextTempo = parseCommittedTempo(value, state.tempo);
  state.tempo = nextTempo;
  elements.tempoSlider.value = String(nextTempo);
  elements.tempoNumber.value = String(nextTempo);
  audioEngine.setTempo(nextTempo);
}

function handleTempoNumberInput(value) {
  const draft = parseTempoDraft(value);
  if (draft.state === 'valid') {
    syncTempo(draft.value);
  }
}

function finalizeTempoNumberInput(value) {
  syncTempo(value === '' ? state.tempo : value);
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
  if (!state.progression || !chordLibrary) {
    renderKeyOptions();
    regenerateProgression();
    return;
  }

  refreshProgression('preserve');
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
    blurSelectAfterCommit(elements.keyRootSelect);
  });

  document.querySelectorAll('input[name="mode-preference"]').forEach((node) => {
    node.addEventListener('change', () => {
      state.modePreference = document.querySelector('input[name="mode-preference"]:checked').value;
      refreshProgression('preserve');
    });
  });

  document.querySelectorAll('input[name="shape-type"]').forEach((node) => {
    node.addEventListener('change', () => {
      readEnabledShapeTypes();
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
    const zoomButton = event.target.closest('[data-zoom-diagram]');
    if (zoomButton && state.progression) {
      const index = Number(zoomButton.getAttribute('data-zoom-diagram'));
      openDiagramZoom(index, zoomButton);
      return;
    }

    const previewButton = event.target.closest('[data-preview-chord]');
    if (previewButton && state.progression) {
      previewChord(Number(previewButton.getAttribute('data-preview-chord')));
      return;
    }

    const button = event.target.closest('[data-cycle-shape]');
    if (!button || !state.progression) return;
    cycleShape(Number(button.getAttribute('data-cycle-shape')));
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

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    const transportMode = target.getAttribute('data-transport-toggle');
    if (!transportMode) return;

    if (transportMode === 'drums') {
      state.playDrums = target.checked;
    } else if (transportMode === 'chords') {
      state.playChords = target.checked;
    } else {
      return;
    }

    syncTransportMode();
    if (!state.playDrums && !state.playChords && audioEngine.isPlaying) {
      audioEngine.stop();
      updateTransportButton(false);
    }
  });

  elements.tempoSlider.addEventListener('input', () => syncTempo(elements.tempoSlider.value));
  elements.tempoNumber.addEventListener('input', () => handleTempoNumberInput(elements.tempoNumber.value));
  elements.tempoNumber.addEventListener('change', () => finalizeTempoNumberInput(elements.tempoNumber.value));
  elements.tempoNumber.addEventListener('blur', () => finalizeTempoNumberInput(elements.tempoNumber.value));

  elements.meterSelect.addEventListener('change', () => {
    state.meter = elements.meterSelect.value;
    renderGrooveOptions();
    blurSelectAfterCommit(elements.meterSelect);
  });

  elements.grooveSelect.addEventListener('change', () => {
    state.groove = elements.grooveSelect.value;
    renderGrooveOptions();
    blurSelectAfterCommit(elements.grooveSelect);
  });

  document.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const transportButton = target.closest('[data-transport-button]');
    if (!transportButton) return;

    const isPlaying = await audioEngine.toggle();
    updateTransportButton(isPlaying);
  });
}

async function init() {
  applyPlatformClassNames();
  ensureReorderStatusRegion();
  syncRhythmControlsFromState();
  renderKeyOptions();
  syncTempo(state.tempo);
  syncTransportMode();
  installAudioPrimer();
  installActionControlsLayoutSync();
  installTooltipDismissal();
  installSelectionSuppression();
  installDiagramZoomInteractions();
  attachLifecycleListeners();
  attachEventListeners();
  chordLibrary = await loadChordLibrary();
  renderKeyOptions();
  regenerateProgression();

  // Some browsers restore prior form control values after module init.
  window.requestAnimationFrame(() => syncRhythmControlsFromState());
  window.setTimeout(() => syncRhythmControlsFromState(), 0);
  window.addEventListener('resize', () => {
    syncPrimaryActionControlsPlacement();
    syncProgressionHeaderActionsLayout();
  });
}

window.addEventListener('pageshow', () => {
  syncPrimaryActionControlsPlacement();
  syncRhythmControlsFromState();
  syncProgressionHeaderActionsLayout();
  void restoreTransportAfterBackground();
});

init().catch((error) => {
  updateWarning('Failed to load chord data.');
  renderEmptyProgression({
    title: 'Chord data did not load'
  });
  console.error(error);
});
