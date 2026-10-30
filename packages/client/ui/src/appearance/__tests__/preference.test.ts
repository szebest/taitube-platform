import { requestHandler } from '@tanstack/react-start/server';
import {
  type AppearancePreference,
  accountAppearance,
  appearanceFromAccount,
  DEFAULT_APPEARANCE,
  requestAppearancePreference,
  type StoredAppearance,
  saveAppearancePreference,
} from '../preference';

const appearanceCookie = (value: unknown) =>
  `vp.appearance=${encodeURIComponent(JSON.stringify(value))}`;

const preference = (overrides: Partial<AppearancePreference> = {}): AppearancePreference => ({
  ...DEFAULT_APPEARANCE,
  ...overrides,
});

async function storedFor(cookie: string): Promise<StoredAppearance> {
  const answer = requestHandler(async () => Response.json(requestAppearancePreference()));
  const response = await answer(new Request('http://localhost:5173/', { headers: { cookie } }), {});
  return response.json();
}

const NOCTURNE_AIRY = preference({
  theme: 'nocturne',
  mode: 'oled',
  accent: '#3D6595',
  contrast: 'more',
  overrides: { spacing: 'airy', radius: 'soft' },
});

const ELSEWHERE = {
  ...NOCTURNE_AIRY,
  theme: 'dusk',
  overrides: { spacing: 'roomy', radius: 'soft', glow: 'on' },
};

describe('@vp/ui: the appearance preference', () => {
  it('defaults to the catalogue: the registry default theme, system mode, no accent, no overrides', () => {
    expect(DEFAULT_APPEARANCE).toEqual({
      schema: 2,
      theme: null,
      mode: 'system',
      accent: null,
      contrast: 'standard',
      overrides: {},
    });
  });

  it.each([
    {
      label: 'a schema 2 cookie as it is',
      cookie: appearanceCookie(NOCTURNE_AIRY),
      stored: { preference: NOCTURNE_AIRY, source: 'appearance' },
    },
    {
      label: 'a theme and a set this app does not offer as they are, dropping an unknown group',
      cookie: appearanceCookie(ELSEWHERE),
      stored: {
        preference: { ...ELSEWHERE, overrides: { spacing: 'roomy', radius: 'soft' } },
        source: 'appearance',
      },
    },
    {
      label: 'ids no account could store as the defaults, keeping every other choice',
      cookie: appearanceCookie({
        ...NOCTURNE_AIRY,
        theme: 'Dusk!',
        overrides: { spacing: 'Roomy Room', radius: 'soft' },
      }),
      stored: {
        preference: { ...NOCTURNE_AIRY, theme: null, overrides: { radius: 'soft' } },
        source: 'appearance',
      },
    },
    {
      label: 'a vp.theme cookie from before schema 2 as the default theme in that mode',
      cookie: 'vp.theme=light',
      stored: { preference: preference({ mode: 'light' }), source: 'legacy' },
    },
    {
      label: 'a cookie that is not JSON as the vp.theme beside it',
      cookie: 'vp.appearance=%7Bnot-json; vp.theme=dark',
      stored: { preference: preference({ mode: 'dark' }), source: 'legacy' },
    },
    {
      label: 'another schema as the defaults',
      cookie: appearanceCookie({ ...NOCTURNE_AIRY, schema: 1 }),
      stored: { preference: DEFAULT_APPEARANCE, source: 'none' },
    },
    {
      label: 'no cookie as the defaults',
      cookie: '',
      stored: { preference: DEFAULT_APPEARANCE, source: 'none' },
    },
  ])('reads $label', async ({ cookie, stored }) => {
    expect(await storedFor(cookie)).toEqual(stored);
  });

  it('keeps the preference for a year on the shared domain, in a form the next request reads back', async () => {
    const document = { cookie: '' };
    vi.stubGlobal('document', document);

    saveAppearancePreference(NOCTURNE_AIRY, 'taitube.local');

    expect(document.cookie).toBe(
      `${appearanceCookie(NOCTURNE_AIRY)}; Max-Age=31536000; Domain=taitube.local; Path=/; SameSite=Lax`
    );
    expect(await storedFor(appearanceCookie(NOCTURNE_AIRY))).toEqual({
      preference: NOCTURNE_AIRY,
      source: 'appearance',
    });
  });

  it('saves back a theme and a set this app does not offer, so another app keeps them', async () => {
    const document = { cookie: '' };
    vi.stubGlobal('document', document);
    const { preference: read } = await storedFor(appearanceCookie(ELSEWHERE));

    saveAppearancePreference(read);

    expect(document.cookie).toContain(
      appearanceCookie({ ...ELSEWHERE, overrides: { spacing: 'roomy', radius: 'soft' } })
    );
  });

  it('hands the account the preference without the cookie schema or a cleared override', () => {
    expect(
      accountAppearance({ ...NOCTURNE_AIRY, overrides: { spacing: 'airy', radius: undefined } })
    ).toEqual({
      theme: 'nocturne',
      mode: 'oled',
      accent: '#3D6595',
      contrast: 'more',
      overrides: { spacing: 'airy' },
    });
  });

  it("reads an account's saved appearance back into a preference, round trip", () => {
    const saved = accountAppearance({ ...NOCTURNE_AIRY, overrides: { spacing: 'airy' } });

    expect(appearanceFromAccount(saved)).toEqual({
      ...NOCTURNE_AIRY,
      overrides: { spacing: 'airy' },
    });
  });
});
