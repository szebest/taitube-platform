import { defineTokenSet } from '@vp/design-tokens';

export const motionStandard = defineTokenSet('motion', 'standard', {
  duration: {
    instant: '80ms',
    fast: '140ms',
    base: '220ms',
    slow: '360ms',
    cinematic: '560ms',
  },
  easing: {
    standard: [0.2, 0, 0, 1],
    enter: [0.05, 0.7, 0.1, 1],
    exit: [0.3, 0, 0.8, 0.15],
    settle: [0.2, 0.8, 0.2, 1],
  },
});
