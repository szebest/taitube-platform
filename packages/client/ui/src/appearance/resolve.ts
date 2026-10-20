import type { Theme, TokenGroup, TokenSet } from '@vp/design-tokens';
import type { AppearancePreference, TokenSetId, TokenSetIds } from './preference';
import { appearance } from './registry';

type Offer = { readonly [G in TokenGroup]: readonly TokenSet<G>[] };

type SetPerGroup = { readonly [G in TokenGroup]: TokenSet<G> };

export type ResolvedAppearance = Readonly<{
  theme: Theme;
  mode: AppearancePreference['mode'];
  accent: AppearancePreference['accent'];
  contrast: AppearancePreference['contrast'];
  sets: SetPerGroup;
}>;

const REDUCED_MOTION: TokenSetId<'motion'> = 'reduced';

const OFFER: Offer = appearance.offer;

const offered = <G extends TokenGroup>(group: G, id: string | undefined) =>
  OFFER[group].find((set) => set.id === id);

/**
 * Per group: the viewer's override, else the app's default (`defaults`), else the theme's. A stored
 * id this registry does not offer counts as no choice, and an unknown theme as the default theme;
 * `registered` holds the themes `registerTheme` added, which a preference may name too.
 */
export function resolveAppearance(
  { theme: themeId, mode, accent, contrast, overrides }: AppearancePreference,
  {
    defaults = {},
    reducedMotion,
    registered = [],
  }: Readonly<{ defaults?: TokenSetIds; reducedMotion: boolean; registered?: readonly Theme[] }>
): ResolvedAppearance {
  const theme =
    [...appearance.themes, ...registered].find(({ id }) => id === themeId) ??
    appearance.defaultTheme;
  const themeDefaults: SetPerGroup = theme.defaults;
  const pick = <G extends TokenGroup>(group: G) =>
    offered(group, overrides[group]) ?? offered(group, defaults[group]) ?? themeDefaults[group];
  return {
    theme,
    mode,
    accent,
    contrast,
    sets: {
      typography: pick('typography'),
      fontSize: pick('fontSize'),
      spacing: pick('spacing'),
      sizing: pick('sizing'),
      radius: pick('radius'),
      border: pick('border'),
      shadow: pick('shadow'),
      ambient: pick('ambient'),
      motion: (reducedMotion ? offered('motion', REDUCED_MOTION) : undefined) ?? pick('motion'),
    },
  };
}
