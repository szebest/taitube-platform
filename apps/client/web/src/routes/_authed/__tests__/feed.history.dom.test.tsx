import { screen, within } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { loaderApi } from '#app/__tests__/loader-api';
import { historyItem, uuid } from '#app/features/library/__tests__/library-fixtures';
import {
  libraryApi,
  renderLibrary,
  useLibraryClock,
} from '#app/features/library/__tests__/render-library';
import { getRouter } from '#app/router';

describe('apps/client/web: /feed/history in the browser', () => {
  useLibraryClock();

  it('lists what was watched by day, each video resuming where it stopped', async () => {
    await renderLibrary('/feed/history', {
      history: [
        historyItem(1, { title: 'Tram ride' }),
        historyItem(2, { title: 'Old film', watchedAt: '2025-01-01T00:00:00.000Z' }),
      ],
    });

    const today = await screen.findByRole('region', { name: 'Today' });
    const older = screen.getByRole('region', { name: 'Older' });

    expect(within(today).getByRole('link', { name: 'Tram ride' })).toHaveAttribute(
      'href',
      `/watch/${uuid(1)}?t=100`
    );
    expect(within(older).getByRole('link', { name: 'Old film' })).toBeInTheDocument();
  });

  it('sends a guest to sign in without asking for their history', async () => {
    const calls: string[] = [];

    const { router } = await renderRoute(getRouter, '/feed/history', {
      handlers: [...libraryApi({ calls }), ...loaderApi()],
    });

    expect(router.state.location.href).toBe('/login?redirect=%2Ffeed%2Fhistory');
    expect(calls).toEqual([]);
  });
});
