import { defineTokenSet } from '@vp/design-tokens';

export const ambientSubtle = defineTokenSet('ambient', 'subtle', {
  enabled: true,
  'opacity-dark': 0.3,
  'opacity-light': 0.15,
  blur: '56px',
  sample: '1000ms',
});
