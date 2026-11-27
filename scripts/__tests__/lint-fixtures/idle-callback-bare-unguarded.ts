export function defer(run: () => void): number {
  return requestIdleCallback(run);
}
