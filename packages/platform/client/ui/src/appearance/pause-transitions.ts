/**
 * Holds every CSS transition for the frame the theme swaps in, so the page changes colour at once
 * instead of fading each element through its `transition` (the legacy styles put one on `*`).
 */
export function pauseTransitions(): void {
  const root = document.documentElement;
  root.dataset.themeSwitching = '';
  requestAnimationFrame(() => requestAnimationFrame(() => delete root.dataset.themeSwitching));
}
