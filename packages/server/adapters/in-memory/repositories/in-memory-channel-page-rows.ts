import { unwrapOr, assertNever } from '@kit/result';
import type { PageItemRef, PageItemRow } from '@vp/core/repositories';
import {
  type PostPayload,
  isChannelPageStream,
  isPostPublished,
  isPublicFeedEligible,
} from '@vp/domain';
import type { InMemoryChannelPageSourcesDeps } from './in-memory-channel-page-sources';

export function videoIdsOf(rows: readonly { kind: string; videoId: string | null }[]): string[] {
  return rows.flatMap(({ kind, videoId }) => (kind === 'video' && videoId ? [videoId] : []));
}

function excerptOf(payload: PostPayload): string {
  switch (payload.kind) {
    case 'text':
      return payload.text;
    case 'images':
      return payload.caption ?? '';
    case 'poll':
    case 'quiz':
      return payload.question;
    case 'video_share':
    case 'playlist_share':
      return payload.comment ?? '';
    default:
      return assertNever(payload, 'PostPayload');
  }
}

export async function hydrateRow(
  deps: InMemoryChannelPageSourcesDeps,
  { kind, id }: PageItemRef
): Promise<PageItemRow | null> {
  switch (kind) {
    case 'video': {
      const video = deps
        .videos()
        .getAllVideos()
        .find((candidate) => candidate.id === id);
      if (!video || !isPublicFeedEligible(video)) return null;
      return {
        kind,
        id,
        title: video.title ?? '',
        thumbnailKey: video.customThumbnailKey ?? video.posterKey ?? null,
        createdAt: video.createdAt,
        channelId: video.channelId,
        ownerUserId: video.ownerId,
        format: video.format,
        durationMs: video.durationMs,
        tags: video.tags ?? [],
        viewsCount: video.viewsCount ?? 0,
        likesCount: video.likesCount ?? 0,
      };
    }
    case 'post': {
      const post = deps.posts().posts.get(id);
      if (!post || !isPostPublished(post.status)) return null;
      return {
        kind,
        id,
        title: excerptOf(post.payload),
        thumbnailKey: null,
        createdAt: post.publishedAt ?? post.createdAt,
        channelId: post.channelId,
        ownerUserId: null,
        likesCount: post.likeCount,
        commentsCount: post.commentsCount,
      };
    }
    case 'playlist': {
      const playlist = deps
        .playlists()
        .getAllPlaylists()
        .find((candidate) => candidate.id === id);
      if (!playlist || playlist.visibility !== 'public' || playlist.isSystem) return null;
      return {
        kind,
        id,
        title: playlist.title,
        thumbnailKey: playlist.customThumbnailKey,
        createdAt: playlist.updatedAt,
        channelId: null,
        ownerUserId: playlist.ownerId,
        itemCount: videoIdsOf(deps.playlists().rowsOf(id)).length,
      };
    }
    case 'live': {
      const stream = deps
        .live()
        .getAll()
        .find((candidate) => candidate.id === id);
      if (!stream || !isChannelPageStream(stream)) return null;
      return {
        kind,
        id,
        title: stream.title,
        thumbnailKey: null,
        createdAt: stream.startedAt ?? stream.createdAt,
        channelId: stream.channelId,
        ownerUserId: null,
        status: stream.status,
        viewers: stream.currentViewers,
        videoId: stream.videoId,
      };
    }
    case 'channel': {
      const channel = unwrapOr(await deps.channels().findById(id), null);
      if (!channel) return null;
      return {
        kind,
        id,
        title: channel.displayName,
        thumbnailKey: null,
        createdAt: channel.createdAt,
        channelId: channel.id,
        ownerUserId: channel.userId,
        handle: channel.handle,
        avatarUrl: channel.avatarUrl ?? null,
      };
    }
    default:
      return assertNever(kind, 'PageItemKind');
  }
}
