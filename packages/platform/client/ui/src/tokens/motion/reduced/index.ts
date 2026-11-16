import { defineTokenSet } from '@vp/design-tokens';

export const motionReduced = defineTokenSet('motion', 'reduced', {
  duration: {
    instant: '0ms',
    fast: '0ms',
    base: '120ms',
    slow: '160ms',
    cinematic: '200ms',
  },
  easing: {
    standard: [0, 0, 1, 1],
    enter: [0, 0, 1, 1],
    exit: [0, 0, 1, 1],
    settle: [0, 0, 1, 1],
  },
});
