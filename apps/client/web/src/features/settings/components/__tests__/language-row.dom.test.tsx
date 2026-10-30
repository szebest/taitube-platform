import { screen } from '@testing-library/react';
import { writeCookie } from '@vp/ui';
import { renderRoute } from '@vp/web-testing/dom';

import { requestDevicePreferences } from '#app/features/settings/device/device-preferences';
import { getRouter } from '#app/router';

const renderLanguage = () => renderRoute(getRouter, '/settings/language');

describe('apps/client/web: the language row', () => {
  afterEach(() => {
    writeCookie('vp.device', '', { maxAge: 0 });
  });

  it('follows the browser until a language is chosen, keeps it on the device, and follows the browser again', async () => {
    const { user } = await renderLanguage();
    const language = await screen.findByRole('combobox', { name: 'Language' });
    expect(language).toHaveTextContent('Follow my browser');

    await user.click(language);
    await user.click(await screen.findByRole('option', { name: 'English' }));
    expect(requestDevicePreferences().locale).toBe('en');

    await user.click(language);
    await user.click(await screen.findByRole('option', { name: 'Follow my browser' }));
    expect(requestDevicePreferences().locale).toBeNull();
  });

  it('keeps a language the list lacks chosen, worded as its tag', async () => {
    writeCookie('vp.device', JSON.stringify({ schema: 1, locale: 'sv' }), { maxAge: 60 });

    await renderLanguage();

    expect(await screen.findByRole('combobox', { name: 'Language' })).toHaveTextContent('sv');
  });
});
