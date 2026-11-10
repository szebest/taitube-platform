import { canModerateComment, canRestrictChannelUser } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { useModerationChannel } from './use-moderation-channel';

/** What the viewer may do to a comment or its author on the channel being moderated, one answer per action. */
export function useModerationAbilities() {
  const channel = useModerationChannel();
  const { ownerId } = channel;

  return {
    approve: useCan(canModerateComment, { action: 'approve', videoOwnerId: ownerId }),
    hide: useCan(canModerateComment, { action: 'hide', videoOwnerId: ownerId }),
    remove: useCan(canModerateComment, { action: 'remove', videoOwnerId: ownerId }),
    restrict: useCan(canRestrictChannelUser, { channel }),
  };
}
