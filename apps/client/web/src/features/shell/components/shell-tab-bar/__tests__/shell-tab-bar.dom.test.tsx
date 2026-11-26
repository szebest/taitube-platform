import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderShell } from '#app/features/shell/__tests__/render-shell';

describe('apps/client/web: shell tab bar', () => {
  it.each([
    {
      viewer: 'a guest',
      url: '/feed/trending',
      signedIn: false,
      active: 'Trending',
      links: [
        ['Home', '/'],
        ['Shorts', '/shorts'],
        ['Trending', '/feed/trending'],
      ],
    },
    {
      viewer: 'a signed-in viewer',
      url: '/',
      signedIn: true,
      active: 'Home',
      links: [
        ['Home', '/'],
        ['Shorts', '/shorts'],
        ['Subscriptions', '/subscriptions/videos'],
        ['Trending', '/feed/trending'],
        ['You', '/feed/you'],
      ],
    },
  ])(
    'offers $viewer the tab bar links, $active marked current',
    async ({ url, signedIn, active, links }) => {
      await renderShell(url, signedIn);

      await waitFor(() => {
        const tabBar = screen.getAllByRole('navigation', { name: 'Main' }).at(-1);
        expect(
          tabBar &&
            within(tabBar)
              .getAllByRole('link')
              .map((link) => [link.textContent, link.getAttribute('href')])
        ).toEqual(links);
        expect(tabBar && within(tabBar).getByRole('link', { name: active })).toHaveAttribute(
          'aria-current',
          'page'
        );
      });
    }
  );

  it('opens the switcher sheet on a long press of the You tab', async () => {
    await renderShell('/', true);
    const tabBar = await waitFor(() => {
      const bar = screen.getAllByRole('navigation', { name: 'Main' }).at(-1);
      if (!bar) throw new Error('no tab bar yet');
      return bar;
    });
    const you = await within(tabBar).findByRole('link', { name: 'You' });

    fireEvent.pointerDown(you, { button: 0 });

    expect(
      await screen.findByRole('dialog', { name: 'Switch account or channel' })
    ).toBeInTheDocument();
    fireEvent.pointerUp(you);
  });
});
