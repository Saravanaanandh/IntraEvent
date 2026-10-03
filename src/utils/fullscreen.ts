// Fullscreen helpers — rounds take the whole screen (scrolling stays enabled;
// we never touch body overflow).
export function isFullscreen(): boolean {
  return typeof document !== 'undefined' && !!document.fullscreenElement;
}

export async function enterFullscreen(): Promise<boolean> {
  try {
    if (isFullscreen()) return true;
    await document.documentElement.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

// Set when WE exit programmatically (round submitted/finished) so the
// focus lock doesn't mistake our own exit for an escape.
let suppressExitReport = false;

export function exitFullscreen() {
  try {
    if (isFullscreen()) {
      suppressExitReport = true;
      void document.exitFullscreen().catch(() => {});
    }
  } catch {
    // ignore
  }
}

// Consumed by the focus-lock handler: true exactly once after our own exit.
export function consumeExitSuppression(): boolean {
  if (suppressExitReport) {
    suppressExitReport = false;
    return true;
  }
  return false;
}
