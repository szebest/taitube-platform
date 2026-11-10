import { renderHook } from '@testing-library/react';
import type { ChannelRole } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { PermissionsProvider } from '@vp/permissions-react';
import type { PropsWithChildren } from 'react';
import { useModerationAbilities } from '../use-moderation-abilities';
import { ModerationChannelProvider } from '../use-moderation-channel';

const CHANNEL = { channelId: 'channel-1', ownerId: 'owner-1' };

function abilitiesOf(role: ChannelRole | 'owner') {
  const viewer: UserContext =
    role === 'owner'
      ? { id: CHANNEL.ownerId, role: 'CREATOR' }
      : {
          id: 'member-1',
          role: 'USER',
          memberships: { [CHANNEL.channelId]: { ownerId: CHANNEL.ownerId, role } },
        };
  const wrapper = ({ children }: PropsWithChildren) => (
    <ModerationChannelProvider channel={CHANNEL}>
      <PermissionsProvider userContext={viewer}>{children}</PermissionsProvider>
    </ModerationChannelProvider>
  );
  return renderHook(useModerationAbilities, { wrapper }).result.current;
}

describe('apps/client/studio: useModerationAbilities', () => {
  it.each<{ role: ChannelRole | 'owner'; abilities: ReturnType<typeof abilitiesOf> }>([
    { role: 'owner', abilities: { approve: true, hide: true, remove: true, restrict: true } },
    { role: 'manager', abilities: { approve: true, hide: true, remove: true, restrict: true } },
    { role: 'moderator', abilities: { approve: true, hide: true, remove: true, restrict: true } },
    { role: 'editor', abilities: { approve: false, hide: false, remove: false, restrict: false } },
  ])('gives a $role what the rules grant', ({ role, abilities }) => {
    expect(abilitiesOf(role)).toEqual(abilities);
  });
});
