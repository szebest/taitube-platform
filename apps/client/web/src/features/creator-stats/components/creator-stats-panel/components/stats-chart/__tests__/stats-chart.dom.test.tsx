import { screen, within } from '@testing-library/react';
import { account, creatorStats } from '@vp/web-testing';
import { renderPanel } from '#app/features/creator-stats/__tests__/render-panel';

vi.mock(import('#app/components/player/taitube-player/taitube-player'), async () => ({
  TaitubePlayer: (await import('#app/__tests__/stub-player')).StubPlayer,
}));

const chart = () => screen.findByRole('img', { name: /^Views by/ });

describe('apps/client/web: StatsChart', () => {
  it('starts on the first 48 hours while that window is open, and switches to the 30 days', async () => {
    const { user } = await renderPanel({ viewer: account() });

    expect(await chart()).toHaveAccessibleName('Views by hour, 90 at the busiest hour');
    expect(screen.getByRole('radio', { name: 'First 48 hours' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Last 30 days' }));

    expect(await chart()).toHaveAccessibleName('Views by day, 900 on the busiest day');
    expect(screen.getByRole('radio', { name: 'Last 30 days' })).toBeChecked();
  });

  it('draws one bar for each hour and each day', async () => {
    const { user } = await renderPanel({ viewer: account() });

    expect((await chart()).querySelectorAll('rect')).toHaveLength(2);
    await user.click(screen.getByRole('radio', { name: 'Last 30 days' }));
    expect((await chart()).querySelectorAll('rect')).toHaveLength(2);
  });

  it('drops the 48 hour option once the window has no data, leaving the 30 days', async () => {
    await renderPanel({ viewer: account(), stats: creatorStats({ first48Hours: null }) });

    const group = await screen.findByRole('radiogroup', { name: 'Time range' });

    expect(
      within(group)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('aria-label') ?? radio.textContent)
    ).toEqual(['Last 30 days']);
    expect(await chart()).toHaveAccessibleName('Views by day, 900 on the busiest day');
  });
});
