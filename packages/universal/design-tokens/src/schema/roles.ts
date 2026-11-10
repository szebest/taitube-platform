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
  'on-media',
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

type RolePair = Readonly<{
  foreground: ColorRole;
  background: ColorRole;
  floor: number;
  /** The ground a translucent background lies on; a pair without one is measured over `bg`. */
  over?: ColorRole;
}>;

const on = (foreground: ColorRole, backgrounds: readonly ColorRole[], floor: number) =>
  backgrounds.map((background): RolePair => ({ foreground, background, floor }));

const onOver = (
  foreground: ColorRole,
  backgrounds: readonly ColorRole[],
  floor: number,
  grounds: readonly ColorRole[] = FLOORS
) =>
  backgrounds.flatMap((background) =>
    grounds.map((over): RolePair => ({ foreground, background, floor, over }))
  );

const GROUNDS: readonly ColorRole[] = ['bg', 'surface'];

/** Every opaque ground a component sits on, and the ones a tint, a pressed tint and a selection are laid over. */
const FLOORS: readonly ColorRole[] = ['bg', 'surface', 'raised'];

const TINTS: readonly ColorRole[] = ['tint', 'tint-strong', 'accent-soft'];

const TONE_INKS: readonly ColorRole[] = ['danger-ink', 'success-ink', 'warning-ink', 'info-ink'];

/** What every theme clears, a theme a viewer builds included. */
const CORE_PAIRS: readonly RolePair[] = [
  ...on('fg', ['bg', 'surface', 'raised', 'accent-soft'], TEXT_FLOOR),
  ...on('fg-muted', ['bg', 'surface', 'raised'], TEXT_FLOOR),
  ...on('border-strong', GROUNDS, NON_TEXT_FLOOR),
  ...on('on-accent', ['accent', 'accent-hover'], TEXT_FLOOR),
  ...on('accent-ink', ['bg', 'surface', 'accent-soft'], TEXT_FLOOR),
  ...on('accent', ['bg'], NON_TEXT_FLOOR),
  ...on('focus-ring', GROUNDS, NON_TEXT_FLOOR),
  ...on('on-live', ['live'], TEXT_FLOOR),
  ...on('on-media', ['media'], TEXT_FLOOR),
  ...on('danger-ink', GROUNDS, TEXT_FLOOR),
  ...on('success-ink', GROUNDS, TEXT_FLOOR),
  ...on('warning-ink', GROUNDS, TEXT_FLOOR),
  ...on('info-ink', GROUNDS, TEXT_FLOOR),
];

/** Every other pair a component draws: the roles of a shipped theme are chosen against all of them. */
const DRAWN_PAIRS: readonly RolePair[] = [
  ...on('fg-subtle', FLOORS, TEXT_FLOOR),
  ...on('border-strong', ['raised'], NON_TEXT_FLOOR),
  ...on('danger', FLOORS, NON_TEXT_FLOOR),
  ...on('focus-ring', ['raised'], NON_TEXT_FLOOR),
  ...onOver('fg', TINTS, TEXT_FLOOR),
  ...onOver('fg-muted', TINTS, TEXT_FLOOR),
  ...TONE_INKS.flatMap((ink) => onOver(ink, TINTS, TEXT_FLOOR)),
];

export type RolePairSet = 'core' | 'drawn';

/** What `data-contrast="more"` adds: the hairline becomes the strong border, so it is a control outline. */
const MORE_PAIRS: readonly RolePair[] = on('border', FLOORS, NON_TEXT_FLOOR);

export type RoleContrast = 'standard' | 'more';

/** The roles a page draws under `data-contrast="more"`: `border` and `fg-muted` follow the stronger roles. */
const underContrast = (roles: RoleColors, contrast: RoleContrast): RoleColors =>
  contrast === 'more' ? { ...roles, border: roles['border-strong'], 'fg-muted': roles.fg } : roles;

const labelOf = ({ foreground, background, over }: RolePair) =>
  `${foreground} on ${background}${over ? ` / ${over}` : ''}`;

/** `core` is the gate for a theme built from two colours; `drawn` adds every pair the product draws. */
export const checkRoleContrast = (
  roles: RoleColors,
  contrast: RoleContrast = 'standard',
  set: RolePairSet = 'drawn'
) => {
  const drawn = underContrast(roles, contrast);
  const pairs = [
    ...CORE_PAIRS,
    ...(set === 'drawn' ? DRAWN_PAIRS : []),
    ...(contrast === 'more' && set === 'drawn' ? MORE_PAIRS : []),
  ];
  return checkContrast(
    pairs.map((pair) => ({
      label: labelOf(pair),
      foreground: drawn[pair.foreground],
      background: unwrapOr(
        compositeOver(drawn[pair.background], drawn[pair.over ?? 'bg']),
        drawn[pair.background]
      ),
      floor: pair.floor,
    }))
  );
};
