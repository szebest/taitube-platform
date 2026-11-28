import { isOk, ok, type Result } from '@kit/result';
import type {
  ChannelPostRepositoryPort,
  ChannelRepositoryPort,
  ClipRepositoryPort,
  ContentRefDirectoryPort,
  LiveStreamRepositoryPort,
  PlaylistRepositoryPort,
  ResolvedContent,
  VideoRepository,
  VideoThreadRepositoryPort,
} from '@vp/core/repositories';
import {
  type ContentRef,
  contentRefKey,
  isPostPublished,
  postTitleOf,
  type Video,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';

export interface ContentRefSources {
  videos: Pick<VideoRepository, 'findById'>;
  clips: Pick<ClipRepositoryPort, 'findById'>;
  posts: Pick<ChannelPostRepositoryPort, 'findById'>;
  threads: Pick<VideoThreadRepositoryPort, 'findById'>;
  playlists: Pick<PlaylistRepositoryPort, 'findById'>;
  liveStreams: Pick<LiveStreamRepositoryPort, 'findById'>;
  channels: Pick<ChannelRepositoryPort, 'findById' | 'findPrimaryByUserId'>;
}

const isVisible = (video: Video) =>
  video.visibility === 'public' && video.status === 'READY' && !video.deletedAt;

async function found<T>(read: Promise<Result<T | null, DatabaseUnavailable>>): Promise<T | null> {
  const result = await read;
  return isOk(result) ? result.value : null;
}

export class InMemoryContentRefDirectory implements ContentRefDirectoryPort {
  constructor(private readonly sources: ContentRefSources) {}

  async resolve(
    refs: readonly ContentRef[]
  ): Promise<Result<Map<string, ResolvedContent>, DatabaseUnavailable>> {
    const resolved = new Map<string, ResolvedContent>();
    for (const ref of refs) {
      const content = await this.one(ref);
      if (content) resolved.set(contentRefKey(ref), content);
    }
    return ok(resolved);
  }

  private async one(ref: ContentRef): Promise<ResolvedContent | null> {
    const { sources } = this;
    switch (ref.type) {
      case 'video': {
        const video = await found(sources.videos.findById(ref.id));
        if (!video) return null;
        return {
          ref,
          channelId: video.channelId,
          ownerId: video.ownerId,
          title: video.title ?? '',
          public: isVisible(video),
          mediaVideoId: video.id,
          durationMs: video.durationMs ?? null,
          format: video.format,
        };
      }
      case 'clip': {
        const clip = await found(sources.clips.findById(ref.id));
        const video = clip && (await found(sources.videos.findById(clip.videoId)));
        if (!clip || !video) return null;
        return {
          ref,
          channelId: video.channelId,
          ownerId: clip.userId,
          title: clip.title,
          public: isVisible(video),
          mediaVideoId: clip.videoId,
          durationMs: clip.endMs - clip.startMs,
          format: null,
        };
      }
      case 'post': {
        const post = await found(sources.posts.findById(ref.id));
        const channel = post && (await found(sources.channels.findById(post.channelId)));
        if (!post || !channel) return null;
        return {
          ref,
          channelId: post.channelId,
          ownerId: channel.userId,
          title: postTitleOf(post.payload),
          public: isPostPublished(post.status),
          mediaVideoId: null,
          durationMs: null,
          format: null,
        };
      }
      case 'thread': {
        const thread = await found(sources.threads.findById(ref.id));
        const video = thread && (await found(sources.videos.findById(thread.videoId)));
        if (!thread || !video) return null;
        return {
          ref,
          channelId: thread.channelId,
          ownerId: video.ownerId,
          title: thread.title,
          public: isVisible(video) && thread.moderationState === 'published',
          mediaVideoId: thread.videoId,
          durationMs: null,
          format: null,
        };
      }
      case 'playlist': {
        const playlist = await this.playlist(ref.id);
        if (!playlist) return null;
        return { ...playlist, ref, mediaVideoId: null, durationMs: null, format: null };
      }
      case 'live': {
        const stream = await found(sources.liveStreams.findById(ref.id));
        const channel = stream && (await found(sources.channels.findById(stream.channelId)));
        if (!stream || !channel) return null;
        return {
          ref,
          channelId: stream.channelId,
          ownerId: channel.userId,
          title: stream.title,
          public: stream.visibility === 'public',
          mediaVideoId: stream.videoId,
          durationMs: null,
          format: null,
        };
      }
      case 'episode': {
        const playlist = await this.playlist(ref.playlistId);
        const video = await found(sources.videos.findById(ref.videoId));
        if (!playlist || !video) return null;
        return {
          ref,
          channelId: video.channelId,
          ownerId: video.ownerId,
          title: video.title ?? '',
          public: isVisible(video) && playlist.public,
          mediaVideoId: video.id,
          durationMs: video.durationMs ?? null,
          format: video.format,
        };
      }
    }
  }

  clear(): void {}

  private async playlist(id: string) {
    const playlist = await found(this.sources.playlists.findById(id));
    const channel =
      playlist && (await found(this.sources.channels.findPrimaryByUserId(playlist.ownerId)));
    if (!playlist || !channel) return null;
    return {
      channelId: channel.id,
      ownerId: playlist.ownerId,
      title: playlist.title,
      public: playlist.visibility === 'public',
    };
  }
}
