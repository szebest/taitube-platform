import { requestHandler } from '@tanstack/react-start/server';
import { DEFAULT_DEVICE_PREFERENCES } from '#app/__tests__/device-preferences-fixtures';
import { type DevicePreferences, requestDevicePreferences } from '../device-preferences';

const cookieOf = (value: unknown) => `vp.device=${encodeURIComponent(JSON.stringify(value))}`;

async function preferencesFor(cookie: string): Promise<DevicePreferences> {
  const answer = requestHandler(async () => Response.json(requestDevicePreferences()));
  const response = await answer(new Request('http://localhost:5173/', { headers: { cookie } }), {});
  return response.json();
}

describe('apps/client/web: device preferences on the server', () => {
  it.each([
    {
      label: 'the locale the cookie holds, and the defaults for every playback field',
      cookie: cookieOf({ schema: 2, locale: 'sv-FI' }),
      expected: { ...DEFAULT_DEVICE_PREFERENCES, locale: 'sv-FI' },
    },
    {
      label: 'the locale of a version 1 cookie, and none of the playback it held',
      cookie: cookieOf({ schema: 1, playback: { speed: 1.5 }, locale: 'sv-FI' }),
      expected: { ...DEFAULT_DEVICE_PREFERENCES, locale: 'sv-FI' },
    },
    { label: 'the defaults with no cookie', cookie: '', expected: DEFAULT_DEVICE_PREFERENCES },
    {
      label: 'the defaults for text that is not JSON',
      cookie: 'vp.device=%7B',
      expected: DEFAULT_DEVICE_PREFERENCES,
    },
    {
      label: 'no locale when it is not a language tag, and the rest of the cookie kept',
      cookie: cookieOf({ schema: 2, locale: 7 }),
      expected: { ...DEFAULT_DEVICE_PREFERENCES, locale: null },
    },
    {
      label: 'the locale of a cookie from a newer version, which this code does not rewrite',
      cookie: cookieOf({ schema: 9, locale: 'sv-FI', ahead: true }),
      expected: { ...DEFAULT_DEVICE_PREFERENCES, locale: 'sv-FI' },
    },
  ])('reads $label', async ({ cookie, expected }) => {
    expect(await preferencesFor(cookie)).toEqual(expected);
  });
});
