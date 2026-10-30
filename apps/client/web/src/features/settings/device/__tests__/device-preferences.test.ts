import { requestHandler } from '@tanstack/react-start/server';

import {
  DEFAULT_DEVICE_PREFERENCES,
  type DevicePreferences,
  requestDevicePreferences,
  saveDevicePreferences,
} from '../device-preferences';

const cookieOf = (value: unknown) => `vp.device=${encodeURIComponent(JSON.stringify(value))}`;

const SAVED: DevicePreferences = {
  schema: 1,
  playback: { ...DEFAULT_DEVICE_PREFERENCES.playback, speed: 1.5, autoplayNext: false },
  locale: 'sv-FI',
};

async function preferencesFor(cookie: string): Promise<DevicePreferences> {
  const answer = requestHandler(async () => Response.json(requestDevicePreferences()));
  const response = await answer(new Request('http://localhost:5173/', { headers: { cookie } }), {});
  return response.json();
}

describe('apps/client/web: device preferences', () => {
  it.each([
    { label: 'what the cookie holds', cookie: cookieOf(SAVED), expected: SAVED },
    { label: 'the defaults with no cookie', cookie: '', expected: DEFAULT_DEVICE_PREFERENCES },
    {
      label: 'the defaults for text that is not JSON',
      cookie: 'vp.device=%7B',
      expected: DEFAULT_DEVICE_PREFERENCES,
    },
    {
      label: 'the defaults for a field that is not a choice',
      cookie: cookieOf({ ...SAVED, playback: { ...SAVED.playback, speed: 9 } }),
      expected: { ...SAVED, playback: { ...SAVED.playback, speed: 1 } },
    },
    {
      label: 'no locale when it is not a language tag',
      cookie: cookieOf({ ...SAVED, locale: 7 }),
      expected: { ...SAVED, locale: null },
    },
  ])('reads $label', async ({ cookie, expected }) => {
    expect(await preferencesFor(cookie)).toEqual(expected);
  });

  it('keeps the preferences in a cookie for a year, so the next server render has them', () => {
    const document = { cookie: '' };
    vi.stubGlobal('document', document);

    saveDevicePreferences(SAVED);

    expect(document.cookie).toBe(`${cookieOf(SAVED)}; Max-Age=31536000; Path=/; SameSite=Lax`);
  });
});
