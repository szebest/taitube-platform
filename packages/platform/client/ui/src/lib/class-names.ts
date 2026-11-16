import {
  CONTROL_SIZES,
  ELEVATION_OPTIONS,
  ICON_SIZES,
  RADIUS_OPTIONS,
  SIZE_OPTIONS,
  SPACE_STEPS,
  TYPE_STYLE_OPTIONS,
  Z_LAYERS,
} from '@vp/design-tokens';
import { type ClassValue, cnMerge, createTV } from 'tailwind-variants';

const LAYOUT_MEASURES = [
  'touch-target',
  'header',
  'rail-expanded',
  'rail-collapsed',
  'card-min',
  'row-thumb',
];

const DURATIONS = ['instant', 'fast', 'base', 'slow', 'cinematic'];

/**
 * The token utilities tailwind-merge cannot guess: without them it reads `text-label` as a colour
 * and drops it beside `text-fg`, and keeps both of two spacing roles.
 */
const twMergeConfig = {
  extend: {
    theme: {
      text: [...TYPE_STYLE_OPTIONS],
      radius: [...RADIUS_OPTIONS],
      shadow: ELEVATION_OPTIONS.map(String),
      spacing: [
        ...SPACE_STEPS.map((step) => step.replace(/^gap-/, '')),
        ...CONTROL_SIZES.map((size) => `control-${size}`),
        ...ICON_SIZES.map((size) => `icon-${size}`),
        ...SIZE_OPTIONS.map((size) => `avatar-${size}`),
        ...LAYOUT_MEASURES,
      ],
    },
    classGroups: {
      z: [{ z: [...Z_LAYERS] }],
      duration: [{ duration: DURATIONS }],
      'border-w': [{ border: ['divider', 'control'] }],
      'outline-w': [{ outline: ['focus'] }],
      'outline-offset': [{ 'outline-offset': ['focus'] }],
    },
  },
};

/** `tv` from tailwind-variants, merging the token utilities too. */
export const tv = createTV({ twMergeConfig });

/** Joins classes, a caller's last, and drops the ones a later class overrides. */
export function cn(...classes: ClassValue[]): string | undefined {
  return cnMerge(...classes)({ twMergeConfig });
}
