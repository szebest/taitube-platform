import type { Theme } from '@vp/design-tokens';
import { ref } from '../../tokens/ref';

export const sandDataviz = {
  'categorical-dark': ['#C9A66B', '#8FB89A', '#7FA3D1', '#D98A6C', '#B59AD6', '#5FB3AE'],
  'categorical-light': ['#86683A', '#3F7A52', '#3D6595', '#A9512F', '#6E54A0', '#237A74'],
  sequential: [
    ref('ochre.100'),
    ref('ochre.300'),
    ref('ochre.500'),
    ref('ochre.700'),
    ref('ochre.900'),
  ],
  diverging: ['#A9512F', '#D98A6C', ref('sand.300'), '#5FB3AE', '#237A74'],
} satisfies Theme['dataviz'];
