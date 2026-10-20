import type { Theme } from '@vp/design-tokens';
import { ref } from '../../tokens/ref';

export const nocturneDataviz = {
  'categorical-dark': ['#FFB547', '#6CB6FF', '#5FD3A8', '#FF8A65', '#A992FF', '#F27BAE'],
  'categorical-light': ['#8A5A10', '#1E6FC2', '#1D8A63', '#C2502D', '#6A4FD0', '#B83F78'],
  sequential: [
    ref('amber.100'),
    ref('amber.300'),
    ref('amber.500'),
    ref('amber.700'),
    ref('amber.900'),
  ],
  diverging: ['#C2502D', '#FF8A65', ref('ink.300'), '#6CB6FF', '#1E6FC2'],
} satisfies Theme['dataviz'];
