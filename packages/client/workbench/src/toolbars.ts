import type { Preview } from '@storybook/react-vite';
import {
  CONTRAST_OPTIONS,
  MODE_OPTIONS,
  TOKEN_GROUPS,
  type TokenGroup,
  tokenGroups,
} from '@vp/design-tokens';
import type { AppearancePreference } from '@vp/ui';
import { appearance } from '@vp/ui/appearance/registry';

/** A group's or the accent's toolbar entry for "no override": the theme's own. */
export const THEME_DEFAULT = 'theme';

/** Accents to try the derivation on, the hostile ones (pure yellow, near-white) included. */
const SAMPLE_ACCENTS = ['#3D6595', '#2F7A47', '#FFFF00', '#F5F5F5'];

export const DIRECTIONS = ['ltr', 'rtl'] as const;

type GlobalTypes = NonNullable<Preview['globalTypes']>;

type Item = { value: string; title: string };

const toolbar = (title: string, items: Item[]) => ({
  name: title,
  toolbar: { title, items, dynamicTitle: true },
});

const named = (values: readonly string[]): Item[] =>
  values.map((value) => ({ value, title: value }));

/** Storybook's `globalTypes`: the registry's themes, the modes and contrast levels, one per group. */
export const appearanceToolbars: GlobalTypes = {
  theme: toolbar(
    'Theme',
    appearance.themes.map(({ id, name }) => ({ value: id, title: name }))
  ),
  mode: toolbar('Mode', named(MODE_OPTIONS.filter((mode) => mode !== 'system'))),
  contrast: toolbar('Contrast', named(CONTRAST_OPTIONS)),
  accent: toolbar('Accent', [
    { value: THEME_DEFAULT, title: 'theme accent' },
    ...named(SAMPLE_ACCENTS),
  ]),
  direction: toolbar('Direction', named(DIRECTIONS)),
  ...Object.fromEntries(
    TOKEN_GROUPS.map((group) => [
      group,
      toolbar(tokenGroups[group].path, [
        { value: THEME_DEFAULT, title: 'theme default' },
        ...named(appearance.offer[group].map(({ id }) => id)),
      ]),
    ])
  ),
};

export const initialAppearanceGlobals: Readonly<Record<string, string>> = {
  theme: appearance.defaultTheme.id,
  mode: 'dark',
  contrast: 'standard',
  accent: THEME_DEFAULT,
  direction: 'ltr',
  ...Object.fromEntries(TOKEN_GROUPS.map((group) => [group, THEME_DEFAULT])),
};

/** A global as one of `options`, or `fallback` when the URL or an old toolbar left something else. */
export const pickOption = <T extends string>(
  options: readonly T[],
  value: unknown,
  fallback: T
): T => options.find((option) => option === value) ?? fallback;

const overridden = (globals: Readonly<Record<string, unknown>>, group: TokenGroup) => {
  const id = globals[group];
  return typeof id === 'string' && id !== THEME_DEFAULT ? [[group, id] as const] : [];
};

/** The preference the toolbars describe, as the apps store it. */
export function preferenceFromGlobals(
  globals: Readonly<Record<string, unknown>>
): AppearancePreference {
  return {
    schema: 2,
    theme: typeof globals.theme === 'string' ? globals.theme : null,
    mode: pickOption(MODE_OPTIONS, globals.mode, 'dark'),
    accent:
      typeof globals.accent === 'string' && globals.accent !== THEME_DEFAULT
        ? globals.accent
        : null,
    contrast: pickOption(CONTRAST_OPTIONS, globals.contrast, 'standard'),
    overrides: Object.fromEntries(TOKEN_GROUPS.flatMap((group) => overridden(globals, group))),
  };
}
