import { screen, within } from '@testing-library/react';
import type { ChannelRole } from '@vp/domain';
import { renderTeam } from '#app/features/team/__tests__/render-team';
import { membership, OTHER_CHANNEL_ID } from '#app/features/team/__tests__/team-api.fixture';

describe('apps/client/studio: ActingUploadAction', () => {
  it.each<{ role: ChannelRole | undefined; shown: boolean }>([
    { role: undefined, shown: true },
    { role: 'editor', shown: true },
    { role: 'moderator', shown: false },
  ])('shows the toolbar upload button to $role: $shown', async ({ role, shown }) => {
    await renderTeam(
      '/team',
      role ? { state: { memberships: [membership(role)] }, actingOn: OTHER_CHANNEL_ID } : {}
    );

    expect(!!within(screen.getByRole('banner')).queryByRole('button', { name: 'Upload' })).toBe(
      shown
    );
  });
});
