import { TOKEN_GROUPS } from '@kit/design-tokens';
import { requestHandler } from '@tanstack/react-start/server';
import { FIXTURE_APPEARANCE_STORAGE } from '../../__tests__/appearance-storage-fixture';
import {
  type AppearancePreference,
  AppearancePreferenceSchema,
  accountAppearance,
  appearanceFromAccount,
  DEFAULT_APPEARANCE,
  requestAppearancePreference,
  type StoredAppearance,
  saveAppearancePreference,
} from '../preference';

const appearanceCookie = (value: unknown) =>
  `acme.appearance=${encodeURIComponent(JSON.stringify(value))}`;

const preference = (overrides: Partial<AppearancePreference> = {}): AppearancePreference => ({
  ...DEFAULT_APPEARANCE,
  ...overrides,
});

async function storedFor(cookie: string): Promise<StoredAppearance> {
  const answer = requestHandler(async () =>
    Response.json(requestAppearancePreference(FIXTURE_APPEARANCE_STORAGE))
  );
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

describe('@kit/ui: the appearance preference', () => {
  it('defaults to the catalogue: the registry default theme, system mode and contrast, no accent, no overrides', () => {
    expect(DEFAULT_APPEARANCE).toEqual({
      schema: 2,
      theme: null,
      mode: 'system',
      accent: null,
      customGround: null,
      customAccent: null,
      contrast: 'auto',
      overrides: {},
    });
  });

  it.each([
    {
      label: 'a schema 2 cookie as it is',
      cookie: appearanceCookie(NOCTURNE_AIRY),
      stored: {
        preference: NOCTURNE_AIRY,
        source: 'appearance',
        storage: FIXTURE_APPEARANCE_STORAGE,
      },
    },
    {
      label: 'a theme and a set this app does not offer as they are, dropping an unknown group',
      cookie: appearanceCookie(ELSEWHERE),
      stored: {
        preference: { ...ELSEWHERE, overrides: { spacing: 'roomy', radius: 'soft' } },
        source: 'appearance',
        storage: FIXTURE_APPEARANCE_STORAGE,
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
        storage: FIXTURE_APPEARANCE_STORAGE,
      },
    },
    {
      label: 'the colours of a built theme as they are',
      cookie: appearanceCookie({
        ...NOCTURNE_AIRY,
        customGround: '#101820',
        customAccent: '#3366cc',
      }),
      stored: {
        preference: { ...NOCTURNE_AIRY, customGround: '#101820', customAccent: '#3366cc' },
        source: 'appearance',
        storage: FIXTURE_APPEARANCE_STORAGE,
      },
    },
    {
      label: 'colours that are not #rrggbb as no built theme',
      cookie: appearanceCookie({ ...NOCTURNE_AIRY, customGround: 'dark', customAccent: '#36c' }),
      stored: {
        preference: NOCTURNE_AIRY,
        source: 'appearance',
        storage: FIXTURE_APPEARANCE_STORAGE,
      },
    },
    {
      label: 'a acme.theme cookie from before schema 2 as the default theme in that mode',
      cookie: 'acme.theme=light',
      stored: {
        preference: preference({ mode: 'light' }),
        source: 'legacy',
        storage: FIXTURE_APPEARANCE_STORAGE,
      },
    },
    {
      label: 'a cookie that is not JSON as the acme.theme beside it',
      cookie: 'acme.appearance=%7Bnot-json; acme.theme=dark',
      stored: {
        preference: preference({ mode: 'dark' }),
        source: 'legacy',
        storage: FIXTURE_APPEARANCE_STORAGE,
      },
    },
    {
      label: 'another schema as the defaults',
      cookie: appearanceCookie({ ...NOCTURNE_AIRY, schema: 1 }),
      stored: {
        preference: DEFAULT_APPEARANCE,
        source: 'none',
        storage: FIXTURE_APPEARANCE_STORAGE,
      },
    },
    {
      label: 'no cookie as the defaults',
      cookie: '',
      stored: {
        preference: DEFAULT_APPEARANCE,
        source: 'none',
        storage: FIXTURE_APPEARANCE_STORAGE,
      },
    },
  ])('reads $label', async ({ cookie, stored }) => {
    expect(await storedFor(cookie)).toEqual(stored);
  });

  it('keeps the preference for a year on the shared domain, in a form the next request reads back', async () => {
    const document = { cookie: '' };
    vi.stubGlobal('document', document);

    saveAppearancePreference(NOCTURNE_AIRY, FIXTURE_APPEARANCE_STORAGE, 'acme.local');

    expect(document.cookie).toBe(
      `${appearanceCookie(NOCTURNE_AIRY)}; Max-Age=31536000; Domain=acme.local; Path=/; SameSite=Lax`
    );
    expect(await storedFor(appearanceCookie(NOCTURNE_AIRY))).toEqual({
      preference: NOCTURNE_AIRY,
      source: 'appearance',
      storage: FIXTURE_APPEARANCE_STORAGE,
    });
  });

  it('saves back a theme and a set this app does not offer, so another app keeps them', async () => {
    const document = { cookie: '' };
    vi.stubGlobal('document', document);
    const { preference: read } = await storedFor(appearanceCookie(ELSEWHERE));

    saveAppearancePreference(read, FIXTURE_APPEARANCE_STORAGE);

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
      customGround: null,
      customAccent: null,
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

  it('stays under 1 KB as a cookie at its worst: every id at its longest, every group overridden', () => {
    const longest = 'a'.repeat(32);
    const worst = {
      ...DEFAULT_APPEARANCE,
      theme: longest,
      accent: '#ffffff',
      customGround: '#ffffff',
      customAccent: '#ffffff',
      contrast: 'standard',
      overrides: Object.fromEntries(TOKEN_GROUPS.map((group) => [group, longest])),
    } as const;

    const cookie = `acme.appearance=${encodeURIComponent(JSON.stringify(worst))}`;

    expect(AppearancePreferenceSchema.parse(worst)).toEqual(worst);
    expect(cookie.length).toBeLessThan(1024);
  });
});
