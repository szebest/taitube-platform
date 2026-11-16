import { defineTokenSet } from '@vp/design-tokens';

export const motionCalm = defineTokenSet('motion', 'calm', {
  duration: {
    instant: '100ms',
    fast: '200ms',
    base: '320ms',
    slow: '480ms',
    cinematic: '720ms',
  },
  easing: {
    standard: [0.2, 0, 0, 1],
    enter: [0.05, 0.7, 0.1, 1],
    exit: [0.3, 0, 0.8, 0.15],
    settle: [0.25, 0.6, 0.2, 1],
  },
});
