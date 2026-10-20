import { ROLES } from '../schema/roles';
import type { Scale } from '../schema/scale';
import type { Theme } from '../schema/theme';
import { TOKEN_GROUPS } from '../schema/token-group';
import { declare, rule, stylesheet, utilities } from './rule';
import { scaleDeclarations } from './scale-css';
import { tokenSetDeclarations } from './token-set-css';

// `reference` keeps Tailwind from re-declaring --font-sans or --shadow-1 on :root as a cycle.
const THEME_AT_RULE = '@theme inline reference';

export const tailwindTheme = (sets: Theme['defaults'], scale: Scale) =>
  stylesheet([
    rule(THEME_AT_RULE, [
      { property: '--color-*', value: 'initial' },
      ...ROLES.map((role) => ({ property: `--color-${role}`, value: `var(--${role})` })),
      ...TOKEN_GROUPS.flatMap((group) => utilities(tokenSetDeclarations(sets[group]))),
      ...utilities(scaleDeclarations(scale)),
      ...declare(scale.breakpoint, (name) => ({ property: `--breakpoint-${name}` })),
    ]),
  ]);
