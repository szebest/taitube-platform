import type { PageHealth, Shift } from './page-health';

export interface ClickPathSummary {
  cls: number;
  largestShift: Shift | null;
  longTasks: { count: number; ms: number };
  inpMs: number;
  keystrokeMs: number;
}

const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

const round = (value: number, places: number) => Number(value.toFixed(places));

const KEYSTROKE_TYPES: readonly string[] = ['keydown', 'keypress', 'keyup'];

/** The numbers `pnpm perf:clicks` prints for a click path: the worst interaction, the typical keystroke in the palette, and the biggest shift with its source. */
export function summarizeClickPath({
  cls,
  shifts,
  longTasks,
  interactions,
}: PageHealth): ClickPathSummary {
  const keystrokes = interactions.filter(
    ({ type, target }) => KEYSTROKE_TYPES.includes(type) && target.startsWith('command')
  );
  return {
    cls: round(cls, 4),
    largestShift: shifts.toSorted((a, b) => b.value - a.value)[0] ?? null,
    longTasks: { count: longTasks.count, ms: Math.round(longTasks.ms) },
    inpMs: Math.max(0, ...interactions.map(({ duration }) => duration)),
    keystrokeMs: median(keystrokes.map(({ duration }) => duration)),
  };
}
