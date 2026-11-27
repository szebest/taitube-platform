import { CONTRAST_OPTIONS, DEFAULT_CONTRAST, DEFAULT_MODE, MODE_OPTIONS } from '@kit/appearance';
import { choice, defineSection, type SectionValues, text, tokenOverrides } from './define';

export const APPEARANCE_SETTINGS = defineSection({
  /** `null` is the app's default theme, which the client's theme registry names. */
  theme: text({ kind: 'preferenceId', scope: 'both', device: 'cookie' }),
  mode: choice({ options: MODE_OPTIONS, default: DEFAULT_MODE, scope: 'both', device: 'cookie' }),
  /** `null` is the theme's own accent. */
  accent: text({ kind: 'accent', scope: 'both', device: 'cookie' }),
  /** With `customAccent`, the theme the viewer built: `null` until they build one. */
  customGround: text({ kind: 'accent', scope: 'both', device: 'cookie' }),
  customAccent: text({ kind: 'accent', scope: 'both', device: 'cookie' }),
  contrast: choice({
    options: CONTRAST_OPTIONS,
    default: DEFAULT_CONTRAST,
    scope: 'both',
    device: 'cookie',
  }),
  overrides: tokenOverrides({ scope: 'both', device: 'cookie' }),
});

export type AppearancePreferences = SectionValues<typeof APPEARANCE_SETTINGS>;

/** The cookies the viewer's appearance lives in on every client app: the current one and the one it replaced. */
export const APPEARANCE_COOKIES = { cookie: 'vp.appearance', legacyCookie: 'vp.theme' } as const;
