import { all, map, type Result } from '@vp/result';
import { type DerivedAccent, deriveAccent } from '../accent';
import type { InvalidColour } from '../color/rgb';
import { MODE_FAMILIES } from '../schema/values';
import { type Declaration, inFamily, rule, stylesheet } from './rule';

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

export const accentCss = (hex: string): Result<string, InvalidColour> =>
  map(
    all(
      MODE_FAMILIES.map((family) =>
        map(deriveAccent(hex, family), (derived) =>
          // One step more specific than a theme rule, so stylesheet order never lets the theme win.
          rule(`:root[data-theme]${inFamily(family)}`, accentRoles(derived))
        )
      )
    ),
    stylesheet
  );
