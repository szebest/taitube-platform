import { canModerateComment, canRestrictChannelUser } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { useModerationChannel } from './use-moderation-channel';

export interface ModerationAbilities {
  approve: boolean;
  hide: boolean;
  remove: boolean;
  restrict: boolean;
}

/** What the viewer may do to a comment or its author on the channel being moderated, one answer per action. */
export function useModerationAbilities(): ModerationAbilities {
  const channel = useModerationChannel();
  const scope = { videoOwnerId: channel.ownerId, videoChannelId: channel.channelId };

  return {
    approve: useCan(canModerateComment, { action: 'approve', ...scope }),
    hide: useCan(canModerateComment, { action: 'hide', ...scope }),
    remove: useCan(canModerateComment, { action: 'remove', ...scope }),
    restrict: useCan(canRestrictChannelUser, { channel }),
  };
}
