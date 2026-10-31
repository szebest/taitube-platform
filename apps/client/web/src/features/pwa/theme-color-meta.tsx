import { useAppearance } from '@vp/ui';
import { themeColorMetas } from './theme-color';

/**
 * The document's `theme-color` tags for the theme and mode on screen: one per colour scheme while
 * the mode follows the system, otherwise one. React hoists them into the head on the server and
 * on the client, so a theme switch rewrites them. The router's `head()` is not used because it
 * keeps one tag per `name`.
 */
export function ThemeColorMeta() {
  const { resolved, preference } = useAppearance();

  return themeColorMetas(resolved.theme, preference.mode).map(({ media, content }) => (
    <meta key={media ?? 'always'} name="theme-color" media={media} content={content} />
  ));
}
