import { choice, defineSection, type SectionValues, text, tokenOverrides } from './define';

const APPEARANCE_MODES = ['system', 'dark', 'light', 'oled'] as const;

const CONTRAST_LEVELS = ['standard', 'more'] as const;

/** Theme and token-set ids. The server knows no registry, so any id of this shape is stored. */
export const PREFERENCE_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
/** Token group names, camelCase because `fontSize` is one. */
export const TOKEN_GROUP_PATTERN = /^[a-z][a-zA-Z0-9]{0,31}$/;
export const ACCENT_PATTERN = /^#[0-9a-f]{6}$/i;
export const MAX_APPEARANCE_OVERRIDES = 16;

export const APPEARANCE_SETTINGS = defineSection({
  /** `null` is the app's default theme, which the client's theme registry names. */
  theme: text({ kind: 'preferenceId', scope: 'both' }),
  mode: choice({ options: APPEARANCE_MODES, default: 'system', scope: 'both' }),
  /** `null` is the theme's own accent. */
  accent: text({ kind: 'accent', scope: 'both' }),
  contrast: choice({ options: CONTRAST_LEVELS, default: 'standard', scope: 'both' }),
  overrides: tokenOverrides({ scope: 'both' }),
});

export type AppearancePreferences = SectionValues<typeof APPEARANCE_SETTINGS>;
