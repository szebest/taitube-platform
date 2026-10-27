const STEPS = 5;

const sequentialStep = (step: number) => `var(--dataviz-sequential-${step})`;

export const SEQUENTIAL = Array.from({ length: STEPS }, (_, index) => sequentialStep(index + 1));

/** The sequential step `value` falls in between `min` and `max`, clamped to the ends. */
export function sequentialScale(value: number, min: number, max: number): string {
  const share = max > min ? (value - min) / (max - min) : 0;
  const clamped = Math.min(Math.max(share, 0), 1);

  return sequentialStep(Math.min(Math.floor(clamped * STEPS), STEPS - 1) + 1);
}
