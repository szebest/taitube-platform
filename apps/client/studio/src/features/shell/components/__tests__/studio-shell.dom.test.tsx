import { screen, within } from '@testing-library/react';
import { account } from '@vp/web-testing';
import { axeViolations, renderRoute } from '@vp/web-testing/dom';
import { signInBrowser } from '#app/__tests__/providers';
import { serveLibrary } from '#app/features/content/__tests__/library-api.fixture';
import { getRouter } from '#app/router';

async function renderShell(url = '/videos') {
  serveLibrary([{ cursor: null, items: [], next: null }]);
  const rendered = await renderRoute(getRouter, url, { handlers: [signInBrowser()] });
  await screen.findByRole('navigation', { name: 'Studio' });
  return rendered;
}

const studioNav = () => screen.getAllByRole('navigation', { name: 'Studio' })[0] as HTMLElement;

describe('apps/client/studio: studio shell', () => {
  it('frames the page in the workspace, with the skip link first and landing on main', async () => {
    await renderShell();

    const skip = screen.getByRole('link', { name: 'Skip to content' });

    expect(document.body.querySelector('a')).toBe(skip);
    expect(skip).toHaveAttribute('href', '#main');
    expect(
      await within(screen.getByRole('main')).findByRole('heading', { name: 'Your videos' })
    ).toBeInTheDocument();
  });

  it('lists the library and marks it as the current page on /videos', async () => {
    await renderShell();

    expect(
      within(studioNav())
        .getAllByRole('link')
        .map((link) => link.textContent)
        .slice(0, 2)
    ).toEqual(['Videos', 'Analytics']);
    expect(within(studioNav()).getByRole('link', { name: 'Videos' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it.each([
    { role: 'ADMIN', shown: true },
    { role: 'CREATOR', shown: false },
  ] as const)('shows the admin entry to a $role: $shown', async ({ role, shown }) => {
    serveLibrary([{ cursor: null, items: [], next: null }]);
    await renderRoute(getRouter, '/videos', { handlers: [signInBrowser(account({ role }))] });

    expect(!!within(studioNav()).queryByRole('link', { name: 'Admin' })).toBe(shown);
  });

  it('opens the upload dialog from the toolbar on any page', async () => {
    const { user } = await renderShell();

    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Upload' }));

    expect(await screen.findByRole('dialog', { name: 'Upload a video' })).toBeInTheDocument();
  });

  it('leads back to the viewer app, and puts the account menu, which holds the appearance, in the toolbar', async () => {
    await renderShell();

    const toolbar = screen.getByRole('banner');

    expect(within(studioNav()).getByRole('link', { name: 'Back to Taitube' })).toHaveAttribute(
      'href',
      'http://localhost:5173'
    );
    expect(within(toolbar).queryByRole('button', { name: 'Appearance' })).toBeNull();
    expect(within(toolbar).getByRole('button', { name: 'Account' })).toBeInTheDocument();
  });

  it('passes axe', async () => {
    await renderShell();

    expect(await axeViolations()).toEqual([]);
  });
});
