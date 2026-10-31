import type { Theme } from '@vp/design-tokens';
import { appearance } from '@vp/ui/appearance/registry';
import { themeBackground } from './theme-color';

type ManifestIcon = {
  src: string;
  sizes: string;
  type: string;
  purpose?: 'any' | 'maskable';
};

export type WebManifest = {
  name: string;
  short_name: string;
  description: string;
  start_url: string;
  scope: string;
  display: 'standalone';
  theme_color?: string;
  background_color?: string;
  icons: ManifestIcon[];
  shortcuts: { name: string; url: string; icons: ManifestIcon[] }[];
};

const ICON_192: ManifestIcon = { src: '/logo192.png', sizes: '192x192', type: 'image/png' };

/** The manifest, coloured by the `bg` role of the registry's default theme in dark mode. */
export function webManifest(theme: Theme = appearance.defaultTheme): WebManifest {
  const background = themeBackground(theme, 'dark');
  return {
    name: 'Taitube',
    short_name: 'Taitube',
    description: 'Share videos with others online!',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    ...(background ? { theme_color: background, background_color: background } : {}),
    icons: [
      { ...ICON_192, purpose: 'any' },
      { src: '/logo512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/app-icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Home', url: '/', icons: [ICON_192] },
      { name: 'Subscriptions', url: '/subscriptions', icons: [ICON_192] },
    ],
  };
}
