import { screen } from '@testing-library/react';
import { readCookie, writeCookie } from '@vp/ui';
import { renderRoute } from '@vp/web-testing/dom';

import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

async function openAppearance() {
  const { user } = await renderRoute(getRouter, '/customization', { handlers: [signInBrowser()] });
  await user.click(screen.getByRole('button', { name: 'Account' }));
  await user.click(screen.getByRole('menuitem', { name: 'Appearance' }));
  const choose = async (name: string) => {
    screen.getByRole('menuitemradio', { name }).focus();
    await user.keyboard('{Enter}');
  };
  return { user, choose };
}

const saved = () => JSON.parse(readCookie('vp.appearance') ?? 'null');

describe('apps/client/studio: shell account menu, appearance', () => {
  afterEach(() => {
    writeCookie('vp.appearance', '', { maxAge: 0 });
  });

  it('offers theme, mode and density beside the channel and upload links', async () => {
    await openAppearance();

    expect(screen.getByRole('menuitem', { name: 'Channel' })).toHaveAttribute(
      'href',
      '/customization'
    );
    expect(screen.getByRole('menuitemradio', { name: 'Sand' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Compact' })).toBeChecked();
  });

  it('links to the full appearance settings on the viewer app', async () => {
    await openAppearance();

    expect(screen.getByRole('menuitem', { name: 'All appearance settings' })).toHaveAttribute(
      'href',
      'http://localhost:5173/settings/appearance'
    );
  });

  it.each([
    { pick: 'Nocturne', saved: { theme: 'nocturne' } },
    { pick: 'Light', saved: { mode: 'light' } },
  ])('writes the shared preference when $pick is picked', async ({ pick, saved: expected }) => {
    const { choose } = await openAppearance();

    await choose(pick);

    expect(saved()).toMatchObject(expected);
  });

  it('writes the density overrides when comfortable is picked', async () => {
    const { choose } = await openAppearance();

    await choose('Comfortable');

    expect(saved().overrides).toEqual({ spacing: 'default', sizing: 'medium' });
  });
});
