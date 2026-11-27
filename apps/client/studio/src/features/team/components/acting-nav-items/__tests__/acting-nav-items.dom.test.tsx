import { screen, within } from '@testing-library/react';
import type { ChannelRole } from '@vp/domain';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import { membership, OTHER_CHANNEL_ID } from '#app/features/team/__tests__/team-api.fixture';

const navLinks = () =>
  within(screen.getAllByRole('navigation', { name: 'Studio' })[0] as HTMLElement)
    .getAllByRole('link')
    .map((link) => link.textContent);

describe('apps/client/studio: ActingNavItems', () => {
  it('shows the owner every page of their channel', async () => {
    await renderTeam();

    expect(navLinks()).toEqual([
      'Videos',
      'Posts',
      'Analytics',
      'Comments',
      'Review queue',
      'Live',
      'Team',
      'Developers',
      'Back to Taitube',
    ]);
  });

  it.each<{ role: ChannelRole; pages: string[] }>([
    {
      role: 'manager',
      pages: ['Videos', 'Posts', 'Analytics', 'Comments', 'Review queue', 'Team'],
    },
    { role: 'editor', pages: ['Videos', 'Posts', 'Analytics'] },
    { role: 'moderator', pages: ['Comments', 'Review queue'] },
    { role: 'analytics', pages: ['Analytics'] },
  ])('shows a $role the pages that role reaches: $pages', async ({ role, pages }) => {
    await renderTeam('/team', {
      state: { memberships: [membership(role)] },
      actingOn: OTHER_CHANNEL_ID,
    });

    expect(navLinks()).toEqual([...pages, 'Developers', 'Back to Taitube']);
  });
});
