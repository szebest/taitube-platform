export const UP_STEPS = ['prerequisites', '.env', 'stack', 'seed', 'ready'] as const;

export type UpStep = (typeof UP_STEPS)[number];

function position(step: UpStep): number {
  return UP_STEPS.indexOf(step) + 1;
}

export function runLabel(step: UpStep): string {
  return `[${position(step)}/${UP_STEPS.length}] ${step}`;
}

export function planLabel(step: UpStep): string {
  return `${position(step)} ${step}`;
}
