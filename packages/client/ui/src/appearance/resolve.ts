import type { TokenGroup } from '@vp/design-tokens';
import type { AppearancePreference, TokenSetId, TokenSetIds } from './preference';
import { appearance } from './registry';

type Registry = typeof appearance;

type OfferedSet<G extends TokenGroup> = Registry['offer'][G][number];

export type ResolvedAppearance = Readonly<{
  theme: Registry['themes'][number];
  mode: AppearancePreference['mode'];
  accent: AppearancePreference['accent'];
  contrast: AppearancePreference['contrast'];
  sets: { readonly [G in TokenGroup]: OfferedSet<G> };
}>;

const REDUCED_MOTION: TokenSetId<'motion'> = 'reduced';

const offered = <G extends TokenGroup>(group: G, id: string | undefined) =>
  appearance.offer[group].find((set): set is OfferedSet<G> => set.id === id);

/**
 * Per group: the viewer's override, else the app's default (`defaults`), else the theme's. A stored
 * id this registry does not offer counts as no choice, and an unknown theme as the default theme.
 */
export function resolveAppearance(
  { theme: themeId, mode, accent, contrast, overrides }: AppearancePreference,
  { defaults = {}, reducedMotion }: Readonly<{ defaults?: TokenSetIds; reducedMotion: boolean }>
): ResolvedAppearance {
  const theme = appearance.themes.find(({ id }) => id === themeId) ?? appearance.defaultTheme;
  const pick = <G extends TokenGroup>(group: G): OfferedSet<G> =>
    offered(group, overrides[group]) ?? offered(group, defaults[group]) ?? theme.defaults[group];
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
