import { defineTheme, type Theme } from '@vp/design-tokens';
import { ambientCinematic } from '../../tokens/ambient/cinematic';
import { borderHairline } from '../../tokens/border/hairline';
import { fontSizeDefault } from '../../tokens/font-size/default';
import { motionStandard } from '../../tokens/motion/standard';
import { radiusRound } from '../../tokens/radius/round';
import { ref } from '../../tokens/ref';
import { shadowSoft } from '../../tokens/shadow/soft';
import { sizingMedium } from '../../tokens/sizing/medium';
import { spacingDefault } from '../../tokens/spacing/default';
import { typographyFigtree } from '../../tokens/typography/figtree';

const color = {
  dark: {
    bg: ref('sand.950'),
    surface: ref('sand.900'),
    raised: ref('sand.850'),
    border: ref('sand.800'),
    'border-strong': ref('sand.500'),
    fg: ref('sand.75'),
    'fg-muted': ref('sand.400'),
    'fg-subtle': ref('sand.500'),
    tint: '#FFFAF012',
    'tint-strong': '#FFFAF01F',
    accent: ref('ochre.500'),
    'accent-hover': ref('ochre.400'),
    'on-accent': ref('sand.950'),
    'accent-ink': ref('ochre.400'),
    'accent-soft': '#C9A66B29',
    'focus-ring': ref('ochre.400'),
    live: ref('signal.live'),
    'on-live': ref('signal.white'),
    danger: ref('signal.red-600'),
    'danger-ink': ref('signal.red-300'),
    'success-ink': ref('signal.green-300'),
    'warning-ink': ref('signal.coral-300'),
    'info-ink': ref('signal.blue-300'),
    scrim: '#0C0B09B8',
    media: ref('signal.black'),
  },
  light: {
    bg: ref('sand.50'),
    surface: ref('sand.0'),
    raised: ref('sand.0'),
    border: ref('sand.200'),
    'border-strong': ref('sand.500'),
    fg: ref('sand.900'),
    'fg-muted': ref('sand.600'),
    'fg-subtle': ref('sand.500'),
    tint: '#1C19150F',
    'tint-strong': '#1C19151A',
    accent: ref('ochre.700'),
    'accent-hover': ref('ochre.800'),
    'on-accent': ref('sand.0'),
    'accent-ink': ref('ochre.800'),
    'accent-soft': ref('ochre.100'),
    'focus-ring': ref('ochre.700'),
    live: ref('signal.live'),
    'on-live': ref('signal.white'),
    danger: ref('signal.red-600'),
    'danger-ink': ref('signal.red-700'),
    'success-ink': ref('signal.green-700'),
    'warning-ink': ref('signal.coral-700'),
    'info-ink': ref('signal.blue-700'),
    scrim: '#1C191599',
    media: ref('signal.black'),
  },
  oled: {
    bg: ref('signal.black'),
    surface: ref('sand.1000'),
    raised: ref('sand.900'),
    border: ref('sand.850'),
  },
} satisfies Theme['color'];

const dataviz = {
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

export const sand = defineTheme({
  id: 'sand',
  name: 'Sand',
  color,
  dataviz,
  defaults: {
    typography: typographyFigtree,
    fontSize: fontSizeDefault,
    spacing: spacingDefault,
    sizing: sizingMedium,
    radius: radiusRound,
    border: borderHairline,
    shadow: shadowSoft,
    ambient: ambientCinematic,
    motion: motionStandard,
  },
});
