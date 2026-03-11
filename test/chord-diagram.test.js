import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { hydrateChordLibrary } from '../public/js/chord-library.js';
import { buildDiagramModel } from '../public/js/chord-diagram.js';

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
  assert.equal(rightHanded.markers[0].x, 110 - leftHanded.markers[0].x + 10);
  assert.notEqual(rightHanded.stringStates[0]?.x, leftHanded.stringStates[0]?.x);
});
