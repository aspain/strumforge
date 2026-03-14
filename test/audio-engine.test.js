import test from 'node:test';
import assert from 'node:assert/strict';

import { AudioEngine, GROOVES } from '../public/js/audio-engine.js';

test('stop clears queued beat pulses so stale chord highlights do not reappear', (t) => {
  const originalWindow = globalThis.window;
  const timeouts = new Map();
  let nextTimeoutId = 1;

  globalThis.window = {
    setTimeout(callback) {
      const timeoutId = nextTimeoutId;
      nextTimeoutId += 1;
      timeouts.set(timeoutId, {
        callback,
        cleared: false
      });
      return timeoutId;
    },
    clearTimeout(timeoutId) {
      const timeout = timeouts.get(timeoutId);
      if (timeout) timeout.cleared = true;
    },
    setInterval() {
      return 1;
    },
    clearInterval() {}
  };

  t.after(() => {
    if (originalWindow === undefined) {
      delete globalThis.window;
      return;
    }
    globalThis.window = originalWindow;
  });

  const pulses = [];
  const engine = new AudioEngine((payload) => {
    pulses.push(payload);
  });

  engine.audioContext = { currentTime: 0 };
  engine.groove = GROOVES[0];
  engine.playDrums = false;
  engine.playChords = true;
  engine.chordSequence = [{ frets: [-1, 3, 2, 0, 1, 0] }];
  engine.playChordAtTime = () => {};

  engine.scheduleStep(0.02, 0, 0);
  assert.equal(timeouts.size, 1);

  engine.stop();

  timeouts.forEach((timeout) => {
    if (!timeout.cleared) timeout.callback();
  });

  assert.deepEqual(pulses, [
    { beatIndex: -1, chordIndex: -1 }
  ]);
});
