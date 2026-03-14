let wakeLockSentinel = null;

function getNativeScreenWakePlugin() {
  return window.Capacitor?.Plugins?.ScreenWake ?? null;
}

async function requestBrowserWakeLock() {
  if (wakeLockSentinel && !wakeLockSentinel.released) {
    return true;
  }

  if (!navigator.wakeLock?.request) {
    return false;
  }

  try {
    const sentinel = await navigator.wakeLock.request('screen');
    wakeLockSentinel = sentinel;
    sentinel.addEventListener?.('release', () => {
      if (wakeLockSentinel === sentinel) {
        wakeLockSentinel = null;
      }
    });
    return true;
  } catch (error) {
    console.warn('Screen wake lock request failed.', error);
    wakeLockSentinel = null;
    return false;
  }
}

async function releaseBrowserWakeLock() {
  if (!wakeLockSentinel) {
    return;
  }

  const sentinel = wakeLockSentinel;
  wakeLockSentinel = null;
  try {
    await sentinel.release();
  } catch (error) {
    console.warn('Screen wake lock release failed.', error);
  }
}

export async function setScreenWakeEnabled(enabled) {
  const nativeScreenWake = getNativeScreenWakePlugin();
  if (nativeScreenWake?.setEnabled) {
    try {
      await nativeScreenWake.setEnabled({ enabled: Boolean(enabled) });
      return true;
    } catch (error) {
      console.warn('Native screen wake control failed.', error);
    }
  }

  if (enabled) {
    return requestBrowserWakeLock();
  }

  await releaseBrowserWakeLock();
  return true;
}
