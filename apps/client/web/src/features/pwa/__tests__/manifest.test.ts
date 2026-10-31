import { appearance } from '@vp/ui/appearance/registry';
import { webManifest } from '../manifest';

const [sand, nocturne] = appearance.themes;

describe('apps/client/web: the web manifest', () => {
  it.each([
    { theme: sand, bg: '#14120F' },
    { theme: nocturne, bg: '#0B0E14' },
  ])('takes both colours from the dark bg of the theme $theme.id', ({ theme, bg }) => {
    expect(webManifest(theme)).toMatchObject({ theme_color: bg, background_color: bg });
  });

  it("follows the registry's default theme", () => {
    expect(webManifest()).toEqual(webManifest(appearance.defaultTheme));
  });

  it('installs as a standalone app with the icon set and the shortcuts', () => {
    const manifest = webManifest();

    expect(manifest).toMatchObject({ name: 'Taitube', display: 'standalone', scope: '/' });
    expect(manifest.icons.map(({ sizes, purpose }) => `${sizes}:${purpose}`)).toEqual([
      '192x192:any',
      '512x512:any',
      'any:maskable',
    ]);
    expect(manifest.shortcuts.map(({ name, url }) => [name, url])).toEqual([
      ['Home', '/'],
      ['Subscriptions', '/subscriptions'],
    ]);
  });
});
