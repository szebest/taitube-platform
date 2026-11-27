export function defer(requestIdleCallback: (run: () => void) => void, run: () => void): void {
  requestIdleCallback(run);
}

export const options = { requestIdleCallback: 1 };
