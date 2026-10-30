import { screen, waitFor } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { getSpecRouter } from './url-modal.fixture';

const openLibrary = (url = '/library') => renderRoute(getSpecRouter, url);

const dialog = () => screen.queryByRole('dialog', { name: 'Share video' });

describe('createUrlModals in the browser', () => {
  it('opens with a pushed history entry and Back closes it without leaving the page', async () => {
    const { router, user } = await openLibrary();
    const before = router.history.length;

    await user.click(screen.getByRole('button', { name: 'Share' }));

    expect(await screen.findByRole('dialog', { name: 'Share video' })).toBeInTheDocument();
    expect(router.history.length).toBe(before + 1);
    expect(router.state.location.search).toEqual({ modal: 'share', videoId: 'v1', start: '30' });
    expect(await screen.findByText('Video v1 at 30s')).toBeInTheDocument();

    router.history.back();

    await waitFor(() => expect(dialog()).not.toBeInTheDocument());
    expect(router.state.location.search).toEqual({});
    expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument();
  });

  it.each([
    {
      how: 'Escape',
      close: (user: Awaited<ReturnType<typeof openLibrary>>['user']) => user.keyboard('{Escape}'),
    },
    {
      how: 'the close button',
      close: (user: Awaited<ReturnType<typeof openLibrary>>['user']) =>
        user.click(screen.getByRole('button', { name: 'Close' })),
    },
    {
      how: 'the backdrop',
      close: (user: Awaited<ReturnType<typeof openLibrary>>['user']) =>
        user.click(document.querySelector('[data-slot="dialog-overlay"]') as Element),
    },
  ])('closes on $how and removes the modal keys from the URL', async ({ close }) => {
    const { router, user } = await openLibrary();
    await user.click(screen.getByRole('button', { name: 'Share' }));
    await screen.findByRole('dialog', { name: 'Share video' });

    await close(user);

    await waitFor(() => expect(dialog()).not.toBeInTheDocument());
    expect(router.state.location.search).toEqual({});
  });

  it('closes a deep-linked modal by replacing the entry and puts focus on the page heading', async () => {
    const { router, user } = await openLibrary('/library?modal=share&videoId=v9&tab=playlists');
    const before = router.history.length;
    expect(await screen.findByText('Video v9 at 0s')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(dialog()).not.toBeInTheDocument());
    expect(router.history.length).toBe(before);
    expect(router.state.location.search).toEqual({ tab: 'playlists' });
    expect(screen.getByRole('heading', { name: 'Library' })).toHaveFocus();
  });

  it('returns focus to the element that opened the modal', async () => {
    const { user } = await openLibrary();
    await user.click(screen.getByRole('button', { name: 'Share' }));
    await screen.findByRole('dialog', { name: 'Share video' });

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Share' })).toHaveFocus());
  });

  it.each([
    { link: 'Playlists tab', how: 'replaces', grows: 0 },
    { link: 'Videos tab', how: 'pushes', grows: 1 },
  ])(
    'a tab link that $how keeps an open modal and changes history by $grows',
    async ({ link, grows }) => {
      const { router, user } = await openLibrary('/library?modal=share&videoId=v1');
      const before = router.history.length;
      await screen.findByRole('dialog', { name: 'Share video' });
      expect(router.history.length).toBe(before);

      await user.keyboard('{Escape}');
      await waitFor(() => expect(dialog()).not.toBeInTheDocument());
      const afterClose = router.history.length;
      await user.click(screen.getByRole('link', { name: link }));

      await waitFor(() => expect(router.state.location.search).toHaveProperty('tab'));
      expect(router.history.length).toBe(afterClose + grows);
    }
  );

  it('keeps the modal open when a link changes only the tab', async () => {
    const { router, user } = await openLibrary('/library?modal=share&videoId=v1');
    await screen.findByRole('dialog', { name: 'Share video' });

    await user.click(screen.getByRole('link', { name: 'Playlists in the dialog' }));

    await waitFor(() => expect(router.state.location.search).toHaveProperty('tab', 'playlists'));
    expect(router.state.location.search).toMatchObject({ modal: 'share', videoId: 'v1' });
  });

  it.each([
    { case: 'an unknown modal id', url: '/library?modal=nope&videoId=v1' },
    { case: 'params the modal refuses', url: '/library?modal=share&start=abc' },
  ])('drops $case and renders no modal', async ({ url }) => {
    await openLibrary(url);

    expect(screen.getByRole('heading', { name: 'Library' })).toBeInTheDocument();
    expect(dialog()).not.toBeInTheDocument();
  });

  it('replaces instead of going back when the entry was opened before a reload', async () => {
    const { router, user } = await openLibrary();
    await router.navigate({
      to: '/library',
      search: { modal: 'share', videoId: 'v1' },
      state: { urlModal: { id: 'share', pageLoad: 'before the reload' } },
    } as never);
    await screen.findByRole('dialog', { name: 'Share video' });
    const before = router.history.length;

    await user.keyboard('{Escape}');

    await waitFor(() => expect(dialog()).not.toBeInTheDocument());
    expect(router.history.length).toBe(before);
  });
});
