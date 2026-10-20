import { unwrapOr } from '@vp/result';
import { compositeOver } from '../color/rgb';
import { checkContrast, NON_TEXT_FLOOR, TEXT_FLOOR } from '../contrast';
import type { HexColor } from './values';

export const ROLES = [
  'bg',
  'surface',
  'raised',
  'border',
  'border-strong',
  'fg',
  'fg-muted',
  'fg-subtle',
  'tint',
  'tint-strong',
  'accent',
  'accent-hover',
  'on-accent',
  'accent-ink',
  'accent-soft',
  'focus-ring',
  'live',
  'on-live',
  'danger',
  'danger-ink',
  'success-ink',
  'warning-ink',
  'info-ink',
  'scrim',
  'media',
] as const;

export type ColorRole = (typeof ROLES)[number];

export type RoleColors = Readonly<Record<ColorRole, HexColor>>;

export const TONE_OPTIONS = [
  'neutral',
  'accent',
  'success',
  'warning',
  'danger',
  'info',
  'live',
] as const;

export type ToneOption = (typeof TONE_OPTIONS)[number];

type RolePair = Readonly<{ foreground: ColorRole; background: ColorRole; floor: number }>;

const on = (foreground: ColorRole, backgrounds: readonly ColorRole[], floor: number) =>
  backgrounds.map((background): RolePair => ({ foreground, background, floor }));

const GROUNDS: readonly ColorRole[] = ['bg', 'surface'];

const REQUIRED_PAIRS: readonly RolePair[] = [
  ...on('fg', ['bg', 'surface', 'raised', 'accent-soft'], TEXT_FLOOR),
  ...on('fg-muted', ['bg', 'surface', 'raised'], TEXT_FLOOR),
  ...on('border-strong', GROUNDS, NON_TEXT_FLOOR),
  ...on('on-accent', ['accent', 'accent-hover'], TEXT_FLOOR),
  ...on('accent-ink', ['bg', 'surface', 'accent-soft'], TEXT_FLOOR),
  ...on('accent', ['bg'], NON_TEXT_FLOOR),
  ...on('focus-ring', GROUNDS, NON_TEXT_FLOOR),
  ...on('on-live', ['live'], TEXT_FLOOR),
  ...on('danger-ink', GROUNDS, TEXT_FLOOR),
  ...on('success-ink', GROUNDS, TEXT_FLOOR),
  ...on('warning-ink', GROUNDS, TEXT_FLOOR),
  ...on('info-ink', GROUNDS, TEXT_FLOOR),
];

export const checkRoleContrast = (roles: RoleColors) =>
  checkContrast(
    REQUIRED_PAIRS.map(({ foreground, background, floor }) => ({
      label: `${foreground} on ${background}`,
      foreground: roles[foreground],
      background: unwrapOr(compositeOver(roles[background], roles.bg), roles[background]),
      floor,
    }))
  );
