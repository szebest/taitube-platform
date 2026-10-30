import { screen } from '@testing-library/react';
import { readCookie, writeCookie } from '@vp/ui';
import { renderRoute } from '@vp/web-testing/dom';

import { getRouter } from '#app/router';

const renderAppearance = () => renderRoute(getRouter, '/settings/appearance');

describe('apps/client/web: the mode row', () => {
  afterEach(() => {
    writeCookie('vp.appearance', '', { maxAge: 0 });
  });

  it('offers system, dark, light and OLED, on system to begin with', async () => {
    await renderAppearance();

    const modes = await screen.findAllByRole('radio', { name: /^(System|Dark|Light|OLED)$/ });

    expect(modes.map((mode) => mode.textContent)).toEqual(['System', 'Dark', 'Light', 'OLED']);
    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked();
  });

  it.each(['dark', 'light', 'oled'])(
    'applies %s at once and keeps it in the cookie',
    async (mode) => {
      const { user } = await renderAppearance();

      await user.click(await screen.findByRole('radio', { name: new RegExp(`^${mode}$`, 'i') }));

      expect(document.documentElement.dataset.mode).toBe(mode);
      expect(JSON.parse(readCookie('vp.appearance') ?? 'null')).toMatchObject({ mode });
    }
  );
});
