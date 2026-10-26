import { ROLES } from '../schema/roles';
import type { Scale } from '../schema/scale';
import type { Theme } from '../schema/theme';
import { TOKEN_GROUPS } from '../schema/token-group';
import { declare, rule, stylesheet, utilities } from './rule';
import { scaleDeclarations } from './scale-css';
import { tokenSetDeclarations } from './token-set-css';

// `reference` keeps Tailwind from re-declaring --font-sans or --shadow-1 on :root as a cycle.
const THEME_AT_RULE = '@theme inline reference';

/** The token utilities beside the colours: `--spacing-inset-card` and the like, one per set and scale value. */
export const tailwindUtilities = (sets: Theme['defaults'], scale: Scale) => [
  ...TOKEN_GROUPS.flatMap((group) => utilities(tokenSetDeclarations(sets[group]))),
  ...utilities(scaleDeclarations(scale)),
];

export const tailwindTheme = (sets: Theme['defaults'], scale: Scale) =>
  stylesheet([
    rule(THEME_AT_RULE, [
      { property: '--color-*', value: 'initial' },
      ...ROLES.map((role) => ({ property: `--color-${role}`, value: `var(--${role})` })),
      ...tailwindUtilities(sets, scale),
      ...declare(scale.breakpoint, (name) => ({ property: `--breakpoint-${name}` })),
    ]),
  ]);
