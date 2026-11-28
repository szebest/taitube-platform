import { fromPromise, map, type Result } from '@kit/result';
import type { ContentRefDirectoryPort, ResolvedContent } from '@vp/core/repositories';
import * as schema from '@vp/db';
import {
  type ContentRef,
  contentRefKey,
  isPostPublished,
  postTitleOf,
  type VideoFormat,
} from '@vp/domain';
import { type DatabaseUnavailable, databaseUnavailable } from '@vp/errors';
import { and, eq, inArray } from 'drizzle-orm';
import type { PostgresDatabase } from './types';

const {
  videos: v,
  clips: cp,
  channelPosts: po,
  videoThreads: th,
  playlists: pl,
  liveStreams: ls,
  channels: ch,
} = schema;

interface VideoFacts {
  channelId: string;
  ownerId: string;
  title: string;
  visible: boolean;
  durationMs: number | null;
  format: VideoFormat;
}

const videoColumns = {
  id: v.id,
  channelId: v.channelId,
  ownerId: v.ownerId,
  title: v.title,
  visibility: v.visibility,
  status: v.status,
  deletedAt: v.deletedAt,
  durationMs: v.durationMs,
  format: v.format,
};

function factsOf(row: {
  channelId: string;
  ownerId: string;
  title: string;
  visibility: string;
  status: string;
  deletedAt: Date | null;
  durationMs: number | null;
  format: VideoFormat;
}): VideoFacts {
  return {
    channelId: row.channelId,
    ownerId: row.ownerId,
    title: row.title,
    visible: row.visibility === 'public' && row.status === 'READY' && row.deletedAt === null,
    durationMs: row.durationMs,
    format: row.format,
  };
}

interface PlaylistFacts {
  id: string;
  ownerId: string;
  title: string;
  channelId: string;
  public: boolean;
}

const idsOf = (refs: readonly ContentRef[], type: ContentRef['type']) =>
  refs.flatMap((ref) => {
    if (ref.type !== type) return [];
    return [ref.type === 'episode' ? ref.videoId : ref.id];
  });

export class PostgresContentRefDirectory implements ContentRefDirectoryPort {
  constructor(private readonly db: PostgresDatabase) {}

  async resolve(
    refs: readonly ContentRef[]
  ): Promise<Result<Map<string, ResolvedContent>, DatabaseUnavailable>> {
    const found = await fromPromise(async () => {
      const lookups = await Promise.all([
        this.videos(refs),
        this.clips(refs),
        this.posts(refs),
        this.threads(refs),
        this.playlists(refs),
        this.live(refs),
        this.episodes(refs),
      ]);
      return new Map(lookups.flat().map((content) => [contentRefKey(content.ref), content]));
    }, databaseUnavailable.during('resolveContentRefs'));
    return map(found, (resolved) => resolved);
  }

  private async videos(refs: readonly ContentRef[]): Promise<ResolvedContent[]> {
    const ids = idsOf(refs, 'video');
    if (ids.length === 0) return [];
    const rows = await this.db.select(videoColumns).from(v).where(inArray(v.id, ids));
    return rows.map((row) => {
      const facts = factsOf(row);
      return {
        ref: { type: 'video', id: row.id },
        channelId: facts.channelId,
        ownerId: facts.ownerId,
        title: facts.title,
        public: facts.visible,
        mediaVideoId: row.id,
        durationMs: facts.durationMs,
        format: facts.format,
      };
    });
  }

  private async clips(refs: readonly ContentRef[]): Promise<ResolvedContent[]> {
    const ids = idsOf(refs, 'clip');
    if (ids.length === 0) return [];
    const rows = await this.db
      .select({ clip: cp, video: videoColumns })
      .from(cp)
      .innerJoin(v, eq(cp.videoId, v.id))
      .where(inArray(cp.id, ids));
    return rows.map(({ clip, video }) => {
      const facts = factsOf(video);
      return {
        ref: { type: 'clip', id: clip.id },
        channelId: facts.channelId,
        ownerId: clip.userId,
        title: clip.title,
        public: facts.visible,
        mediaVideoId: clip.videoId,
        durationMs: clip.endMs - clip.startMs,
        format: null,
      };
    });
  }

  private async posts(refs: readonly ContentRef[]): Promise<ResolvedContent[]> {
    const ids = idsOf(refs, 'post');
    if (ids.length === 0) return [];
    const rows = await this.db
      .select({ post: po, ownerId: ch.userId })
      .from(po)
      .innerJoin(ch, eq(po.channelId, ch.id))
      .where(inArray(po.id, ids));
    return rows.map(({ post, ownerId }) => ({
      ref: { type: 'post', id: post.id },
      channelId: post.channelId,
      ownerId,
      title: postTitleOf(post.payload),
      public: isPostPublished(post.status),
      mediaVideoId: null,
      durationMs: null,
      format: null,
    }));
  }

  private async threads(refs: readonly ContentRef[]): Promise<ResolvedContent[]> {
    const ids = idsOf(refs, 'thread');
    if (ids.length === 0) return [];
    const rows = await this.db
      .select({ thread: th, video: videoColumns })
      .from(th)
      .innerJoin(v, eq(th.videoId, v.id))
      .where(inArray(th.id, ids));
    return rows.map(({ thread, video }) => ({
      ref: { type: 'thread', id: thread.id },
      channelId: thread.channelId,
      ownerId: video.ownerId,
      title: thread.title,
      public: factsOf(video).visible && thread.moderationState === 'published',
      mediaVideoId: thread.videoId,
      durationMs: null,
      format: null,
    }));
  }

  private async playlists(refs: readonly ContentRef[]): Promise<ResolvedContent[]> {
    const ids = idsOf(refs, 'playlist');
    if (ids.length === 0) return [];
    const rows = await this.playlistFacts(ids);
    return rows.map((row) => ({
      ref: { type: 'playlist', id: row.id },
      channelId: row.channelId,
      ownerId: row.ownerId,
      title: row.title,
      public: row.public,
      mediaVideoId: null,
      durationMs: null,
      format: null,
    }));
  }

  private async live(refs: readonly ContentRef[]): Promise<ResolvedContent[]> {
    const ids = idsOf(refs, 'live');
    if (ids.length === 0) return [];
    const rows = await this.db
      .select({ stream: ls, ownerId: ch.userId })
      .from(ls)
      .innerJoin(ch, eq(ls.channelId, ch.id))
      .where(inArray(ls.id, ids));
    return rows.map(({ stream, ownerId }) => ({
      ref: { type: 'live', id: stream.id },
      channelId: stream.channelId,
      ownerId,
      title: stream.title,
      public: stream.visibility === 'public',
      mediaVideoId: stream.videoId,
      durationMs: null,
      format: null,
    }));
  }

  private async episodes(refs: readonly ContentRef[]): Promise<ResolvedContent[]> {
    const episodes = refs.filter((ref) => ref.type === 'episode');
    if (episodes.length === 0) return [];
    const videoRows = await this.db
      .select(videoColumns)
      .from(v)
      .where(inArray(v.id, idsOf(refs, 'episode')));
    const playlists = await this.playlistFacts(episodes.map(({ playlistId }) => playlistId));
    const videoById = new Map(videoRows.map((row) => [row.id, row]));
    const playlistById = new Map(playlists.map((row) => [row.id, row]));
    return episodes.flatMap((ref) => {
      const video = videoById.get(ref.videoId);
      const playlist = playlistById.get(ref.playlistId);
      if (!video || !playlist) return [];
      const facts = factsOf(video);
      return [
        {
          ref,
          channelId: facts.channelId,
          ownerId: facts.ownerId,
          title: facts.title,
          public: facts.visible && playlist.public,
          mediaVideoId: video.id,
          durationMs: facts.durationMs,
          format: facts.format,
        },
      ];
    });
  }

  private async playlistFacts(ids: readonly string[]): Promise<PlaylistFacts[]> {
    const rows = await this.db
      .select({
        id: pl.id,
        ownerId: pl.ownerId,
        title: pl.title,
        visibility: pl.visibility,
        channelId: ch.id,
      })
      .from(pl)
      .leftJoin(ch, and(eq(ch.userId, pl.ownerId), eq(ch.isPrimary, true)))
      .where(inArray(pl.id, [...ids]));
    return rows.flatMap(({ channelId, visibility, ...row }) =>
      channelId === null ? [] : [{ ...row, channelId, public: visibility === 'public' }]
    );
  }
}
