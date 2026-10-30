import { screen, within } from '@testing-library/react';
import { account } from '@vp/web-testing';
import { axeViolations, renderRoute } from '@vp/web-testing/dom';
import { signInBrowser } from '#app/__tests__/providers';
import { getRouter } from '#app/router';

const renderShell = (url: string) => renderRoute(getRouter, url, { handlers: [signInBrowser()] });

const studioNav = () => screen.getAllByRole('navigation', { name: 'Studio' })[0] as HTMLElement;

describe('apps/client/studio: studio shell', () => {
  it('frames the page in the workspace, with the skip link first and landing on main', async () => {
    await renderShell('/upload');

    const skip = screen.getByRole('link', { name: 'Skip to content' });

    expect(document.body.querySelector('a')).toBe(skip);
    expect(skip).toHaveAttribute('href', '#main');
    expect(within(screen.getByRole('main')).getByLabelText('Video title')).toBeInTheDocument();
  });

  it.each([
    { url: '/upload', current: 'page' },
    { url: '/no-such-page', current: null },
  ])('marks upload as the current page on $url', async ({ url, current }) => {
    await renderShell(url);

    expect(
      within(studioNav()).getByRole('link', { name: 'Upload' }).getAttribute('aria-current')
    ).toBe(current);
  });

  it.each([
    { role: 'ADMIN', shown: true },
    { role: 'CREATOR', shown: false },
  ] as const)('shows the admin entry to a $role: $shown', async ({ role, shown }) => {
    await renderRoute(getRouter, '/upload', { handlers: [signInBrowser(account({ role }))] });

    expect(!!within(studioNav()).queryByRole('link', { name: 'Admin' })).toBe(shown);
  });

  it('leads back to the viewer app, and puts the appearance and account menus in the toolbar', async () => {
    await renderShell('/upload');

    const toolbar = screen.getByRole('banner');

    expect(within(studioNav()).getByRole('link', { name: 'Back to Taitube' })).toHaveAttribute(
      'href',
      'http://localhost:5173'
    );
    expect(within(toolbar).getByRole('button', { name: 'Appearance' })).toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: 'Account' })).toBeInTheDocument();
  });

  it('passes axe', async () => {
    await renderShell('/upload');

    expect(await axeViolations()).toEqual([]);
  });
});
