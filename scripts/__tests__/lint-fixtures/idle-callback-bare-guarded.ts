export function defer(run: () => void): void {
  if (typeof requestIdleCallback !== 'function') {
    run();
    return;
  }
  requestIdleCallback(run);
}
