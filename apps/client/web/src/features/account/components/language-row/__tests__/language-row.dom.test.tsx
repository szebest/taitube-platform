import { screen } from '@testing-library/react';
import { writeCookie } from '@vp/ui';
import { renderRoute } from '@vp/web-testing/dom';
import { requestDevicePreferences } from '#app/lib/preferences/device-preferences';
import { getRouter } from '#app/router';

const renderLanguage = (languages: readonly string[] = ['en-US', 'en']) => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
  return renderRoute(getRouter, '/settings/language');
};

async function optionNames(user: Awaited<ReturnType<typeof renderLanguage>>['user']) {
  await user.click(await screen.findByRole('combobox'));
  return (await screen.findAllByRole('option')).map((option) => option.textContent);
}

describe('apps/client/web: the language row', () => {
  afterEach(() => {
    writeCookie('vp.device', '', { maxAge: 0 });
  });

  it('follows the browser until a language is chosen, keeps it on the device, and follows the browser again', async () => {
    const { user } = await renderLanguage();
    const language = await screen.findByRole('combobox', { name: 'Language' });
    expect(language).toHaveTextContent('Follow my browser (English)');

    await user.click(language);
    await user.click(await screen.findByRole('option', { name: 'English' }));
    expect(requestDevicePreferences().locale).toBe('en');

    await user.click(language);
    await user.click(await screen.findByRole('option', { name: 'Follow my browser (English)' }));
    expect(requestDevicePreferences().locale).toBeNull();
  });

  it.each([
    {
      browser: 'English',
      languages: ['en-US'],
      options: ['Follow my browser (English)', 'English', 'Polski'],
    },
    {
      browser: 'Polish',
      languages: ['pl-PL', 'en'],
      options: ['Zgodnie z przeglądarką (Polski)', 'English', 'Polski'],
    },
    {
      browser: 'unserved',
      languages: ['de-DE'],
      options: ['Follow my browser', 'English', 'Polski'],
    },
  ])(
    'names each language in itself, the $browser browser language beside following it',
    async ({ languages, options }) => {
      const { user } = await renderLanguage(languages);

      expect(await optionNames(user)).toEqual(options);
    }
  );

  it('switches the page to the chosen language in place, keeping the query cache', async () => {
    const { user, queryClient } = await renderLanguage();
    const language = await screen.findByRole('combobox', { name: 'Language' });
    const cached = queryClient.getQueryCache().getAll();

    await user.click(language);
    await user.click(await screen.findByRole('option', { name: 'Polski' }));

    expect(await screen.findByRole('combobox', { name: 'Język' })).toBe(language);
    expect(document.documentElement.lang).toBe('pl');
    expect(cached).not.toEqual([]);
    expect(queryClient.getQueryCache().getAll()).toEqual(expect.arrayContaining(cached));
  });

  it('keeps a language the list lacks chosen, worded as its tag', async () => {
    writeCookie('vp.device', JSON.stringify({ schema: 1, locale: 'sv' }), { maxAge: 60 });

    await renderLanguage();

    expect(await screen.findByRole('combobox', { name: 'Language' })).toHaveTextContent('sv');
  });
});
