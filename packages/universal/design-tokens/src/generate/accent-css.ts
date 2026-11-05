import { all, map, type Result } from '@vp/result';
import { type DerivedAccent, deriveAccent } from '../accent';
import type { InvalidColour } from '../color/rgb';
import { MODE_FAMILIES } from '../schema/values';
import { attribute, type Declaration, inFamily, rule, stylesheet } from './rule';

const accentRoles = ({
  accent,
  accentHover,
  accentSoft,
  onAccent,
  accentInk,
}: DerivedAccent): Declaration[] => [
  { property: '--accent', value: accent },
  { property: '--accent-hover', value: accentHover },
  { property: '--accent-soft', value: accentSoft },
  { property: '--on-accent', value: onAccent },
  { property: '--accent-ink', value: accentInk },
  { property: '--focus-ring', value: accent },
];

const accentRules = (hex: string, scope: string): Result<string, InvalidColour> =>
  map(
    all(
      MODE_FAMILIES.map((family) =>
        map(deriveAccent(hex, family), (derived) =>
          // One step more specific than a theme rule, so stylesheet order never lets the theme win.
          rule(`:root[data-theme]${inFamily(family)}${scope}`, accentRoles(derived))
        )
      )
    ),
    stylesheet
  );

export const accentCss = (hex: string): Result<string, InvalidColour> => accentRules(hex, '');

/** The value of `data-brand` on the element a channel's accent is scoped to: the hex, lower case, no hash. */
export const brandKey = (hex: string) => hex.slice(1).toLowerCase();

/**
 * The derived accent roles for one subtree, `[data-brand="<brandKey>"]`, in the mode family the page
 * is in. Only the accent roles are set there, so `live`, `danger` and the status roles stay the theme's.
 */
export const brandAccentCss = (hex: string): Result<string, InvalidColour> =>
  accentRules(hex, ` ${attribute('brand', brandKey(hex))}`);
