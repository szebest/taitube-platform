import { screen, within } from '@testing-library/react';
import { renderRoute } from '@vp/web-testing/dom';

import { signInBrowser } from '#app/__tests__/providers';
import { serveAnalytics } from '#app/features/analytics/__tests__/analytics-api.fixture';
import { getRouter } from '#app/router';

const searchOf = (router: { state: { location: { searchStr: string } } }) =>
  Object.fromEntries(new URLSearchParams(router.state.location.searchStr));

async function renderAnalytics(url: string) {
  const requests = serveAnalytics({ views: [10, 0, 30] });
  const rendered = await renderRoute(getRouter, url, { handlers: [signInBrowser()] });
  await screen.findByRole('heading', { level: 1, name: 'Analytics' });
  return { ...rendered, requests };
}

describe('apps/client/studio: /analytics', () => {
  it('shows the channel for the last 30 days by default', async () => {
    const { requests } = await renderAnalytics('/analytics');

    expect(await screen.findByText('Views, last 30 days')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '30 days' })).toBeChecked();
    expect(new Set(requests)).toEqual(new Set([{ scope: 'channel', range: '30d' }]));
  });

  it('shows the four figures and the daily views, each in its own frame', async () => {
    await renderAnalytics('/analytics');

    expect(await screen.findByText('Views per day')).toBeInTheDocument();
    expect(await screen.findByText('Average view duration, last 30 days')).toBeInTheDocument();
  });

  it('switches the range, says so in the address and asks the API for it', async () => {
    const { requests, router, user } = await renderAnalytics('/analytics');

    await user.click(screen.getByRole('radio', { name: '7 days' }));

    await vi.waitFor(() => expect(searchOf(router)).toEqual({ range: '7d' }));
    expect(await screen.findByText('Views, last 7 days')).toBeInTheDocument();
    expect(requests.at(-1)).toEqual({ scope: 'channel', range: '7d' });
  });

  it('restores the range from the address', async () => {
    await renderAnalytics('/analytics?range=90d');

    expect(screen.getByRole('radio', { name: '90 days' })).toBeChecked();
  });

  it('is reached from the studio navigation', async () => {
    const { user } = await renderAnalytics('/analytics');

    expect(
      within(screen.getAllByRole('navigation', { name: 'Studio' })[0] as HTMLElement).getByRole(
        'link',
        {
          name: 'Analytics',
        }
      )
    ).toHaveAttribute('aria-current', 'page');
    await user.click(screen.getByRole('radio', { name: '7 days' }));
  });
});
