import { choice, defineSection, type SectionValues, text, tokenOverrides } from './define';

const APPEARANCE_MODES = ['system', 'dark', 'light', 'oled'] as const;

const CONTRAST_LEVELS = ['standard', 'more'] as const;

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
