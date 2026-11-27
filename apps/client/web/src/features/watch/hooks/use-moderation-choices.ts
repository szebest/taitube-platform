import type { CommentView } from '@vp/api-contracts';
import { canModerateComment, canRestrictChannelUser } from '@vp/permissions';
import { useCan } from '@vp/permissions-react';
import { useAccount } from '@vp/queries';

export type ModerationChoice =
  | 'hold'
  | 'approve'
  | 'hide'
  | 'unhide'
  | 'remove'
  | 'shadow_ban'
  | 'ban'
  | 'lift';

type CommentStatus = CommentView['status'];

const ONLY_IN: Partial<Record<ModerationChoice, CommentStatus>> = {
  hold: 'published',
  approve: 'held',
  hide: 'published',
  unhide: 'hidden',
};

export interface ModerationScope {
  videoOwnerId: string;
  /** The video's channel, when the video has one the viewer can name. */
  channelId: string | undefined;
}

/** The moderation actions this viewer may take on this comment as it stands, in menu order. */
export function useModerationChoices(
  comment: CommentView,
  { videoOwnerId, channelId }: ModerationScope
): ModerationChoice[] {
  const viewerId = useAccount()?.user.id;
  const videoChannelId = channelId ?? '';
  const may = {
    hold: useCan(canModerateComment, { action: 'hold', videoOwnerId, videoChannelId }),
    approve: useCan(canModerateComment, { action: 'approve', videoOwnerId, videoChannelId }),
    hide: useCan(canModerateComment, { action: 'hide', videoOwnerId, videoChannelId }),
    unhide: useCan(canModerateComment, { action: 'unhide', videoOwnerId, videoChannelId }),
    remove: useCan(canModerateComment, { action: 'remove', videoOwnerId, videoChannelId }),
  };
  const mayRestrict = useCan(canRestrictChannelUser, {
    channel: { channelId: channelId ?? '', ownerId: videoOwnerId },
  });
  const restrictable =
    mayRestrict &&
    channelId !== undefined &&
    !comment.author.isCreator &&
    comment.author.userId !== viewerId;

  const onComment = (['hold', 'approve', 'hide', 'unhide', 'remove'] as const).filter(
    (choice) => may[choice] && (ONLY_IN[choice] ?? comment.status) === comment.status
  );

  return restrictable ? [...onComment, 'shadow_ban', 'ban', 'lift'] : onComment;
}
