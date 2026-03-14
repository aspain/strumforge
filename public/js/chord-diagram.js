function xForString(stringNumber, leftHanded) {
  const index = stringNumber - 1;
  return leftHanded ? 22 + index * 20 : 122 - index * 20;
}

function yForFret(fretIndex) {
  return 28 + fretIndex * 24;
}

function getDisplayBaseFret(shape) {
  if (shape.baseFret > 1) {
    return shape.baseFret;
  }

  const playedFrets = [
    ...shape.frets.filter((fret) => fret > 0),
    ...(shape.barres || []).map((barre) => barre.fret)
  ];

  if (!playedFrets.length || shape.frets.includes(0)) {
    return 1;
  }

  return Math.max(1, Math.min(...playedFrets));
}

export function buildDiagramModel(shape, { leftHanded = false } = {}) {
  const markers = [];
  const stringStates = [];
  const labels = [];
  const displayBaseFret = getDisplayBaseFret(shape);

  for (let stringNumber = 1; stringNumber <= 6; stringNumber += 1) {
    const shapeIndex = 6 - stringNumber;
    const fret = shape.frets[shapeIndex];
    const finger = shape.fingers[shapeIndex];
    const x = xForString(stringNumber, leftHanded);
    if (fret === -1) {
      stringStates.push({ type: 'mute', x, symbol: '×', stringNumber });
      continue;
    }
    if (fret === 0) {
      stringStates.push({ type: 'open', x, symbol: '○', stringNumber });
      continue;
    }

    const displayedFret = displayBaseFret > 1 ? fret - displayBaseFret + 1 : fret;
    markers.push({
      x,
      y: yForFret(displayedFret - 0.5),
      finger,
      fret,
      stringNumber
    });
    if (finger > 0) {
      labels.push({
        x,
        y: yForFret(displayedFret - 0.5) + 0.5,
        text: String(finger),
        stringNumber
      });
    }
  }

  const barres = (shape.barres || []).map((barre) => {
    const displayedFret = displayBaseFret > 1 ? barre.fret - displayBaseFret + 1 : barre.fret;
    return {
      x1: xForString(barre.fromString, leftHanded),
      x2: xForString(barre.toString, leftHanded),
      y: yForFret(displayedFret - 0.5),
      finger: barre.finger
    };
  });

  return {
    baseFret: displayBaseFret,
    visibleFrets: 5,
    markers,
    labels,
    stringStates,
    barres
  };
}

export function renderChordDiagram(shape, options = {}) {
  const model = buildDiagramModel(shape, options);
  const bottomY = 28 + model.visibleFrets * 24;
  const viewBoxHeight = bottomY + 18;
  const viewBoxLeft = -12;
  const viewBoxWidth = 156;
  const baseFretLabelY = yForFret(0);
  const baseFretLabelX = model.baseFret >= 10 ? 17 : 18;
  const baseFretText = model.baseFret > 1
    ? `<text x="${baseFretLabelX}" y="${baseFretLabelY}" class="diagram-basefret">${model.baseFret}fr</text>`
    : '';

  const strings = Array.from({ length: 6 }, (_, index) => {
    const stringNumber = index + 1;
    const x = xForString(stringNumber, options.leftHanded);
    return `<line x1="${x}" y1="28" x2="${x}" y2="${bottomY}" class="diagram-string" />`;
  }).join('');

  const frets = Array.from({ length: model.visibleFrets + 1 }, (_, index) => {
    const y = 28 + index * 24;
    const className = index === 0 && model.baseFret === 1 ? 'diagram-nut' : 'diagram-fret';
    return `<line x1="22" y1="${y}" x2="122" y2="${y}" class="${className}" />`;
  }).join('');

  const stringStates = model.stringStates.map((state) => (
    `<text x="${state.x}" y="20" class="diagram-state">${state.symbol}</text>`
  )).join('');

  const barres = model.barres.map((barre) => (
    `<line x1="${barre.x1}" y1="${barre.y}" x2="${barre.x2}" y2="${barre.y}" class="diagram-barre" />`
  )).join('');

  const dots = model.markers.map((marker) => (
    `<circle cx="${marker.x}" cy="${marker.y}" r="7.5" class="diagram-dot" />`
  )).join('');

  const labels = model.labels.map((label) => (
    `<text x="${label.x}" y="${label.y}" class="diagram-finger">${label.text}</text>`
  )).join('');

  return `
    <svg viewBox="${viewBoxLeft} 0 ${viewBoxWidth} ${viewBoxHeight}" class="chord-diagram" aria-hidden="true" focusable="false">
      ${baseFretText}
      ${strings}
      ${frets}
      ${barres}
      ${stringStates}
      ${dots}
      ${labels}
    </svg>
  `;
}
