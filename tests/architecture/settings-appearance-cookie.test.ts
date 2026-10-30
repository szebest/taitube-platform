import { productionSources, read } from './repo-files';

const SETTINGS = 'apps/client/web/src/features/settings/';

const APPEARANCE_COOKIE = /vp\.appearance|\b(?:request|save|rewriteLegacy)AppearancePreference\b/;

describe('architecture: the settings feature leaves the appearance cookie to the appearance engine', () => {
  const sources = productionSources().filter((file) => file.startsWith(SETTINGS));

  it.each([
    { shape: 'the cookie name', source: "readCookie('vp.appearance')" },
    { shape: 'the engine read', source: 'const saved = requestAppearancePreference();' },
    { shape: 'the engine write', source: 'saveAppearancePreference(next);' },
  ])('recognises $shape', ({ source }) => {
    expect(APPEARANCE_COOKIE.test(source)).toBe(true);
  });

  it('reads and writes appearance only through useAppearance', () => {
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.filter((file) => APPEARANCE_COOKIE.test(read(file)))).toEqual([]);
  });
});
