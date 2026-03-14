import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { hydrateChordLibrary } from '../public/js/chord-library.js';
import { buildDiagramModel, renderChordDiagram } from '../public/js/chord-diagram.js';

async function loadShape(shapeId) {
  const file = new URL('../public/data/chord-shapes.json', import.meta.url);
  const raw = JSON.parse(await readFile(file, 'utf8'));
  const library = hydrateChordLibrary(raw);
  return library.openShapes.find((shape) => shape.id === shapeId);
}

test('left-handed diagrams mirror string placement', async () => {
  const cShape = await loadShape('c-open-major');
  const rightHanded = buildDiagramModel(cShape, { leftHanded: false });
  const leftHanded = buildDiagramModel(cShape, { leftHanded: true });

  assert.ok(rightHanded.markers.length > 0);
  assert.ok(leftHanded.markers.length > 0);
  assert.equal(rightHanded.markers[0].x, 144 - leftHanded.markers[0].x);
  assert.notEqual(rightHanded.stringStates[0]?.x, leftHanded.stringStates[0]?.x);
  assert.ok(rightHanded.markers[0].x > leftHanded.markers[0].x);
  assert.equal(rightHanded.labels[0].x, rightHanded.markers[0].x);
  assert.ok(Math.abs(rightHanded.labels[0].y - rightHanded.markers[0].y) < 2);
});

test('high-position shapes render inside a fixed five-fret viewport', () => {
  const shape = {
    frets: [-1, 7, 9, 9, -1, -1],
    fingers: [0, 1, 3, 4, 0, 0],
    barres: [],
    baseFret: 1
  };

  const model = buildDiagramModel(shape);

  assert.equal(model.baseFret, 7);
  assert.equal(model.visibleFrets, 5);
  assert.deepEqual(model.markers.map((marker) => marker.y), [88, 88, 40]);
});

test('high-position diagrams place the base fret label beside the top displayed fret', () => {
  const shape = {
    frets: [-1, 5, 7, 7, -1, -1],
    fingers: [0, 1, 3, 4, 0, 0],
    barres: [],
    baseFret: 5
  };

  const svg = renderChordDiagram(shape);

  assert.match(svg, /<svg viewBox="-12 0 156 166" class="chord-diagram"/);
  assert.match(svg, /<text x="18" y="28" class="diagram-basefret">5fr<\/text>/);
});

test('double-digit base fret labels shift slightly left to preserve clearance from the diagram', () => {
  const shape = {
    frets: [-1, 11, 13, 13, -1, -1],
    fingers: [0, 1, 3, 4, 0, 0],
    barres: [],
    baseFret: 11
  };

  const svg = renderChordDiagram(shape);

  assert.match(svg, /<svg viewBox="-12 0 156 166" class="chord-diagram"/);
  assert.match(svg, /<text x="17" y="28" class="diagram-basefret">11fr<\/text>/);
});
