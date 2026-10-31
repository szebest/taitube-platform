import { screen, within } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { loaderApi } from '#app/__tests__/loader-api';
import { STUDIO_URL } from '#app/config';
import {
  historyItem,
  libraryVideo,
  ownedPlaylist,
  uuid,
  WATCH_LATER_ID,
} from '#app/features/library/__tests__/library-fixtures';
import {
  libraryApi,
  renderLibrary,
  useLibraryClock,
} from '#app/features/library/__tests__/render-library';
import { getRouter } from '#app/router';

const shelf = (name: string) => screen.findByRole('region', { name });

describe('apps/client/web: /feed/you in the browser', () => {
  useLibraryClock();

  it('shows the four shelves, each heading linking to its page', async () => {
    await renderLibrary('/feed/you', {
      history: [historyItem(1, { title: 'Tram ride' })],
      playlists: [
        ownedPlaylist(0, { id: WATCH_LATER_ID, title: 'Watch later', isSystem: true }),
        ownedPlaylist(1, { title: 'Road trips' }),
      ],
      watchLater: [libraryVideo(7, 'Saved for later')],
      uploads: [libraryVideo(8, 'My upload')],
    });

    const history = await shelf('History');
    expect(within(history).getByRole('link', { name: 'History' })).toHaveAttribute(
      'href',
      '/feed/history'
    );
    expect(within(history).getByRole('link', { name: 'Tram ride' })).toBeInTheDocument();
    expect(
      within(await shelf('Watch later')).getByRole('link', { name: 'Watch later' })
    ).toHaveAttribute('href', `/playlist?list=${WATCH_LATER_ID}`);
    expect(
      within(await shelf('Watch later')).getByRole('link', { name: 'Saved for later' })
    ).toBeInTheDocument();
    const playlists = await shelf('Playlists');
    expect(within(playlists).getByRole('link', { name: 'Playlists' })).toHaveAttribute(
      'href',
      '/feed/playlists'
    );
    expect(within(playlists).getByRole('link', { name: 'Road trips' })).toHaveAttribute(
      'href',
      `/playlist?list=${uuid(4001)}`
    );
    expect(within(playlists).queryByRole('link', { name: 'Watch later' })).toBeNull();
    const videos = await shelf('Your videos');
    expect(within(videos).getByRole('link', { name: 'Your videos' })).toHaveAttribute(
      'href',
      STUDIO_URL
    );
    expect(within(videos).getByRole('link', { name: 'My upload' })).toBeInTheDocument();
  });

  it.each([
    { name: 'History', line: 'Videos you watch show up here', action: 'Browse videos', href: '/' },
    {
      name: 'Watch later',
      line: 'Videos you save for later show up here',
      action: 'Browse videos',
      href: '/',
    },
    {
      name: 'Playlists',
      line: 'Playlists you make show up here',
      action: 'Browse videos',
      href: '/',
    },
    {
      name: 'Your videos',
      line: 'Videos you upload show up here',
      action: 'Upload a video',
      href: STUDIO_URL,
    },
  ])(
    'shows one line and one action for an empty $name shelf',
    async ({ name, line, action, href }) => {
      await renderLibrary('/feed/you', {
        playlists: [ownedPlaylist(0, { id: WATCH_LATER_ID, isSystem: true })],
        uploads: [],
      });

      const empty = await shelf(name);

      expect(within(empty).getByText(line)).toBeInTheDocument();
      expect(within(empty).getByRole('link', { name: action })).toHaveAttribute('href', href);
      expect(within(empty).queryByRole('article')).toBeNull();
    }
  );

  it('is the You tab of the bar and the heading of the You group in the rail', async () => {
    await renderLibrary('/feed/you');

    await shelf('History');

    const [rail, tabBar] = screen.getAllByRole('navigation', { name: 'Main' });
    expect(rail && within(rail).getByRole('link', { name: 'You' })).toHaveAttribute(
      'href',
      '/feed/you'
    );
    expect(tabBar && within(tabBar).getByRole('link', { name: 'You' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('sends a guest to sign in without asking for their library', async () => {
    const calls: string[] = [];

    const { router } = await renderRoute(getRouter, '/feed/you', {
      handlers: [...libraryApi({ calls }), ...loaderApi()],
    });

    expect(router.state.location.href).toBe('/login?redirect=%2Ffeed%2Fyou');
    expect(calls).toEqual([]);
  });
});
