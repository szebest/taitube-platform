import { screen } from '@testing-library/react';
import { writeCookie } from '@vp/ui';
import { renderRoute } from '@vp/web-testing/dom';
import { requestDevicePreferences } from '#app/features/settings/device/device-preferences';
import { getRouter } from '#app/router';

const renderAccessibility = () => renderRoute(getRouter, '/settings/accessibility');

const saved = () => requestDevicePreferences().playback;

describe('apps/client/web: the captions rows', () => {
  afterEach(() => {
    writeCookie('vp.device', '', { maxAge: 0 });
  });

  it('turns captions on by default, kept on the device', async () => {
    const { user } = await renderAccessibility();

    await user.click(await screen.findByRole('switch', { name: 'Captions on by default' }));

    expect(saved().captionsOn).toBe(true);
  });

  it("starts on the video's own language, and keeps the one chosen, or none again", async () => {
    const { user } = await renderAccessibility();
    const language = await screen.findByRole('combobox', { name: 'Captions language' });
    expect(language).toHaveTextContent("The video's own");

    await user.click(language);
    await user.click(await screen.findByRole('option', { name: 'French' }));
    expect(saved().captionsLanguage).toBe('fr');

    await user.click(language);
    await user.click(await screen.findByRole('option', { name: "The video's own" }));
    expect(saved().captionsLanguage).toBeNull();
  });

  it('keeps a language the list lacks chosen, worded as its tag', async () => {
    writeCookie(
      'vp.device',
      JSON.stringify({ schema: 1, playback: { captionsLanguage: 'sv' }, locale: null }),
      { maxAge: 60 }
    );

    await renderAccessibility();

    expect(await screen.findByRole('combobox', { name: 'Captions language' })).toHaveTextContent(
      'sv'
    );
  });
});
