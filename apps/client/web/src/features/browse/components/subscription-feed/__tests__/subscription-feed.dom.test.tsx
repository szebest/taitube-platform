import { screen } from '@testing-library/react';
import { renderPosts } from '#app/__tests__/render-posts';

describe('apps/client/web: subscription feed tabs', () => {
  it('opens on the videos and switches to the Community posts, keeping the choice in the address', async () => {
    const { user, router } = await renderPosts('/subscriptions/videos');

    expect(await screen.findByRole('tab', { name: 'Videos', selected: true })).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Subscription videos' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Community' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Community posts' })
    ).toBeInTheDocument();
    expect(await screen.findByText('A new episode is out')).toBeInTheDocument();
    expect(router.state.location.search).toEqual({ tab: 'community' });
  });

  it('opens the Community tab straight from the address', async () => {
    await renderPosts('/subscriptions/videos?tab=community');

    expect(
      await screen.findByRole('tab', { name: 'Community', selected: true })
    ).toBeInTheDocument();
    expect(await screen.findByText('A new episode is out')).toBeInTheDocument();
  });

  it('falls back to the videos for a tab it does not know', async () => {
    await renderPosts('/subscriptions/videos?tab=posts');

    expect(await screen.findByRole('tab', { name: 'Videos', selected: true })).toBeInTheDocument();
  });
});
