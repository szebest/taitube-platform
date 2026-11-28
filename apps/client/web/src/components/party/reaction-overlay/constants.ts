export const RISE_MS = 1800;

export const RISE_FRAMES: Keyframe[] = [
  { opacity: 1, transform: 'translateY(0) scale(1)' },
  { opacity: 1, transform: 'translateY(-4rem) scale(1.15)', offset: 0.6 },
  { opacity: 0, transform: 'translateY(-7rem) scale(1.3)' },
];
