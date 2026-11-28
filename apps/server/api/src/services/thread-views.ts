import type { ThreadListView, ThreadView } from '@vp/api-contracts';
import type { Video, VideoThreadEntry } from '@vp/domain';
import { placeThreadMarkers } from '@vp/domain-rules';
import { type UserContext, canModerateComment } from '@vp/permissions';

/**
 * A moderator sees the state in full, the author only what was told to them, and a silent state
 * reads as published to everyone else the repository lets see it.
 */
function statusOf(
  { thread }: VideoThreadEntry,
  video: Pick<Video, 'ownerId' | 'channelId'>,
  viewer: UserContext | null
): ThreadView['status'] {
  if (thread.moderationState === 'published') return 'published';
  const moderates = canModerateComment({
    user: viewer,
    action: 'hold',
    videoOwnerId: video.ownerId,
    videoChannelId: video.channelId,
  });
  const toldToAuthor = viewer?.id === thread.authorId && thread.moderationDisclosure === 'visible';
  return moderates || toldToAuthor ? thread.moderationState : 'published';
}

export function toThreadView(
  entry: VideoThreadEntry,
  video: Pick<Video, 'ownerId' | 'channelId'>,
  viewer: UserContext | null
): ThreadView {
  const { thread, author, replyCount } = entry;
  return {
    id: thread.id,
    videoId: thread.videoId,
    anchorMs: thread.anchorMs,
    title: thread.title,
    body: thread.body,
    isPinned: thread.pinnedAt !== null,
    replyCount,
    status: statusOf(entry, video, viewer),
    author,
    createdAt: thread.createdAt.toISOString(),
  };
}

export function toThreadListView(
  entries: readonly VideoThreadEntry[],
  video: Pick<Video, 'ownerId' | 'channelId' | 'durationMs'>,
  viewer: UserContext | null
): ThreadListView {
  const markers = placeThreadMarkers(
    entries
      .filter(
        ({ thread, authorShadowed }) => thread.moderationState === 'published' && !authorShadowed
      )
      .map(({ thread, markerReplies, markerRepliers }) => ({
        id: thread.id,
        anchorMs: thread.anchorMs,
        pinned: thread.pinnedAt !== null,
        replyCount: markerReplies,
        repliers: markerRepliers,
      })),
    video.durationMs ?? 0
  );
  return { items: entries.map((entry) => toThreadView(entry, video, viewer)), markers };
}
