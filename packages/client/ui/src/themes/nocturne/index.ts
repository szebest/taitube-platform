import { defineTheme, type Theme } from '@vp/design-tokens';
import { ambientSubtle } from '../../tokens/ambient/subtle';
import { borderRegular } from '../../tokens/border/regular';
import { fontSizeDefault } from '../../tokens/font-size/default';
import { motionStandard } from '../../tokens/motion/standard';
import { radiusSharp } from '../../tokens/radius/sharp';
import { ref } from '../../tokens/ref';
import { shadowFlat } from '../../tokens/shadow/flat';
import { sizingMedium } from '../../tokens/sizing/medium';
import { spacingDefault } from '../../tokens/spacing/default';
import { typographyGeist } from '../../tokens/typography/geist';

const color = {
  dark: {
    bg: ref('ink.950'),
    surface: ref('ink.900'),
    raised: ref('ink.850'),
    border: ref('ink.800'),
    'border-strong': ref('ink.600'),
    fg: ref('ink.75'),
    'fg-muted': ref('ink.400'),
    'fg-subtle': ref('ink.500'),
    tint: '#EDF1F712',
    'tint-strong': '#EDF1F721',
    accent: ref('amber.500'),
    'accent-hover': ref('amber.400'),
    'on-accent': ref('ink.950'),
    'accent-ink': ref('amber.400'),
    'accent-soft': '#FFB54726',
    'focus-ring': ref('amber.400'),
    live: ref('signal.live'),
    'on-live': ref('signal.white'),
    danger: ref('signal.red-600'),
    'danger-ink': ref('signal.red-300'),
    'success-ink': ref('signal.green-300'),
    'warning-ink': ref('signal.coral-300'),
    'info-ink': ref('signal.blue-300'),
    scrim: '#06080CB8',
    media: ref('signal.black'),
  },
  light: {
    bg: ref('ink.50'),
    surface: ref('ink.0'),
    raised: ref('ink.0'),
    border: ref('ink.200'),
    'border-strong': ref('ink.500'),
    fg: ref('ink.900'),
    'fg-muted': ref('ink.600'),
    'fg-subtle': ref('ink.500'),
    tint: '#1217220F',
    'tint-strong': '#1217221A',
    accent: ref('amber.700'),
    'accent-hover': ref('amber.600'),
    'on-accent': ref('ink.950'),
    'accent-ink': ref('amber.800'),
    'accent-soft': ref('amber.100'),
    'focus-ring': ref('amber.800'),
    live: ref('signal.live'),
    'on-live': ref('signal.white'),
    danger: ref('signal.red-600'),
    'danger-ink': ref('signal.red-700'),
    'success-ink': ref('signal.green-700'),
    'warning-ink': ref('signal.coral-700'),
    'info-ink': ref('signal.blue-700'),
    scrim: '#12172299',
    media: ref('signal.black'),
  },
  oled: {
    bg: ref('signal.black'),
    surface: ref('ink.1000'),
    raised: ref('ink.900'),
    border: ref('ink.850'),
  },
} satisfies Theme['color'];

const dataviz = {
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

export const nocturne = defineTheme({
  id: 'nocturne',
  name: 'Nocturne',
  color,
  dataviz,
  defaults: {
    typography: typographyGeist,
    fontSize: fontSizeDefault,
    spacing: spacingDefault,
    sizing: sizingMedium,
    radius: radiusSharp,
    border: borderRegular,
    shadow: shadowFlat,
    ambient: ambientSubtle,
    motion: motionStandard,
  },
});
