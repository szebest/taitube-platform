const DUCK_ATTACK_MS = 150;
const DUCK_RELEASE_MS = 600;
export const DEFAULT_DUCK_LEVEL = 0.4;
const STEP_MS = 30;

interface DuckTarget {
  volume(): number;
  setVolume(volume: number): void;
}

export interface Ducker {
  setAudible(audible: boolean): void;
  dispose(): void;
}

/** Lowers the player to `level` of where it was while someone is audible, and eases it back: 150 ms down, 600 ms up. */
export function createDucker(target: DuckTarget, level: () => number): Ducker {
  let base: number | null = null;
  let ducked = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  const ramp = (to: number, durationMs: number, onDone?: () => void) => {
    clearInterval(timer);
    const from = target.volume();
    const startedAt = Date.now();
    timer = setInterval(() => {
      const progress = Math.min(1, (Date.now() - startedAt) / durationMs);
      target.setVolume(from + (to - from) * progress);
      if (progress === 1) {
        clearInterval(timer);
        onDone?.();
      }
    }, STEP_MS);
  };

  return {
    setAudible: (audible) => {
      if (audible === ducked) return;
      ducked = audible;
      if (audible) {
        base ??= target.volume();
        ramp(base * level(), DUCK_ATTACK_MS);
        return;
      }
      if (base !== null) {
        ramp(base, DUCK_RELEASE_MS, () => {
          base = null;
        });
      }
    },
    dispose: () => {
      clearInterval(timer);
      if (base !== null) target.setVolume(base);
      base = null;
    },
  };
}
