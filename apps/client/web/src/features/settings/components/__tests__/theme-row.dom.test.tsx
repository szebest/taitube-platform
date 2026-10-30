import { screen } from '@testing-library/react';
import { readCookie, writeCookie } from '@vp/ui';
import { renderRoute } from '@vp/web-testing/dom';

import { getRouter } from '#app/router';

vi.mock(import('@vp/ui/appearance/registry'), async (importOriginal) =>
  (await import('#app/features/settings/__tests__/extended-registry')).extendRegistry(
    await importOriginal()
  )
);

const renderAppearance = () => renderRoute(getRouter, '/settings/appearance');

const theme = (name: string) => screen.findByRole('radio', { name });

describe('apps/client/web: the theme row', () => {
  afterEach(() => {
    writeCookie('vp.appearance', '', { maxAge: 0 });
  });

  it('shows one card per theme of the registry, one added there included, the current one chosen', async () => {
    await renderAppearance();

    expect(await theme('Sand')).toBeChecked();
    expect(await theme('Nocturne')).not.toBeChecked();
    expect(await theme('Dune')).toBeInTheDocument();
  });

  it('switches the whole app to the theme picked, at once, and keeps it in the cookie', async () => {
    const { user } = await renderAppearance();

    await user.click(await theme('Nocturne'));

    expect(document.documentElement.dataset.theme).toBe('nocturne');
    expect(await theme('Nocturne')).toBeChecked();
    expect(JSON.parse(readCookie('vp.appearance') ?? 'null')).toMatchObject({ theme: 'nocturne' });
  });
});
