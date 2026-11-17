import { isErr, ok, type Result } from '@kit/result';
import type { ExportRowRepositoryPort, ExportScope, VideoRecord } from '@vp/core/repositories';
import {
  type ChannelAnalyticsExportRow,
  type CommentExportRow,
  type ExportRowPage,
  type VideoAnalyticsExportRow,
  type VideoExportRow,
  viewDateOf,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { InMemoryCategoryRepository } from './in-memory-category-repository';
import type { InMemoryChannelRepository } from './in-memory-channel-repository';
import type { InMemoryCommentRepository } from './in-memory-comment-repository';
import type { InMemorySubscriptionRepository } from './in-memory-subscription-repository';
import type { InMemoryVideoRepository } from './in-memory-video-repository';
import type { InMemoryVideoViewRepository } from './in-memory-video-view-repository';

export interface InMemoryExportRowRepositoryOptions {
  videos: Pick<InMemoryVideoRepository, 'getAllVideos'>;
  views: Pick<InMemoryVideoViewRepository, 'dailyCounts' | 'retentionCounts'>;
  comments: Pick<InMemoryCommentRepository, 'comments'>;
  channels: Pick<InMemoryChannelRepository, 'getAllChannels'>;
  subscriptions: Pick<InMemorySubscriptionRepository, 'subscriptionEvents'>;
  categories: Pick<InMemoryCategoryRepository, 'findAll'>;
}

type Page<Row> = Promise<Result<ExportRowPage<Row>, DatabaseUnavailable>>;

/** Whole datasets sorted as the postgres adapter orders them, paged by offset. */
function pageOf<Row>(rows: Row[], after: string | null, limit: number): ExportRowPage<Row> {
  const offset = after === null ? 0 : Number(after);
  const end = offset + limit;
  return { rows: rows.slice(offset, end), next: end < rows.length ? String(end) : null };
}

function onDays(day: string, { from, to }: ExportScope['range']): boolean {
  return (!from || day >= from) && (!to || day <= to);
}

const byCreated = (a: { createdAt: Date; id: string }, b: { createdAt: Date; id: string }) =>
  a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id);

export class InMemoryExportRowRepository implements ExportRowRepositoryPort {
  constructor(private readonly deps: InMemoryExportRowRepositoryOptions) {}

  private videosOf({ ownerId }: ExportScope): Map<string, VideoRecord> {
    const owned = this.deps.videos
      .getAllVideos()
      .filter((video) => video.ownerId === ownerId && !video.deletedAt);
    return new Map(owned.map((video) => [video.id, video]));
  }

  async videoAnalytics(
    scope: ExportScope,
    after: string | null,
    limit: number
  ): Page<VideoAnalyticsExportRow> {
    const videos = this.videosOf(scope);
    const title = (videoId: string) => videos.get(videoId)?.title ?? '';
    const daily = this.deps.views
      .dailyCounts()
      .filter(({ videoId, viewDate }) => videos.has(videoId) && onDays(viewDate, scope.range))
      .sort((a, b) => a.videoId.localeCompare(b.videoId) || a.viewDate.localeCompare(b.viewDate))
      .map(({ videoId, viewDate, views, watchSeconds }) => ({
        videoId,
        title: title(videoId),
        series: 'daily' as const,
        day: viewDate,
        views,
        watchSeconds,
        percent: null,
        viewers: null,
      }));
    const retention = this.deps.views
      .retentionCounts()
      .filter(({ videoId }) => videos.has(videoId))
      .sort((a, b) => a.videoId.localeCompare(b.videoId) || a.percent - b.percent)
      .map(({ videoId, percent, viewers }) => ({
        videoId,
        title: title(videoId),
        series: 'retention' as const,
        day: null,
        views: null,
        watchSeconds: null,
        percent,
        viewers,
      }));
    return ok(pageOf([...daily, ...retention], after, limit));
  }

  async channelAnalytics(
    scope: ExportScope,
    after: string | null,
    limit: number
  ): Page<ChannelAnalyticsExportRow> {
    const videos = this.videosOf(scope);
    const days = new Map<string, ChannelAnalyticsExportRow>();
    const dayOf = (day: string) => {
      const row = days.get(day) ?? {
        day,
        views: 0,
        watchSeconds: 0,
        subscribersGained: 0,
        subscribersLost: 0,
      };
      days.set(day, row);
      return row;
    };
    for (const { videoId, viewDate, views, watchSeconds } of this.deps.views.dailyCounts()) {
      if (!videos.has(videoId)) continue;
      const row = dayOf(viewDate);
      row.views += views;
      row.watchSeconds += watchSeconds;
    }
    for (const { channelId, delta, occurredAt } of this.deps.subscriptions.subscriptionEvents()) {
      if (channelId !== scope.channelId) continue;
      const row = dayOf(viewDateOf(occurredAt));
      if (delta > 0) row.subscribersGained += 1;
      else row.subscribersLost += 1;
    }
    const rows = [...days.values()]
      .filter(({ day }) => onDays(day, scope.range))
      .sort((a, b) => a.day.localeCompare(b.day));
    return ok(pageOf(rows, after, limit));
  }

  async comments(scope: ExportScope, after: string | null, limit: number): Page<CommentExportRow> {
    const videos = this.videosOf(scope);
    const channels = new Map(
      this.deps.channels.getAllChannels().map((channel) => [channel.userId, channel])
    );
    const rows = [...this.deps.comments.comments.values()]
      .filter(
        (comment) =>
          comment.deletedAt === null &&
          videos.has(comment.videoId) &&
          onDays(viewDateOf(comment.createdAt), scope.range)
      )
      .sort(byCreated)
      .map((comment) => {
        const author = channels.get(comment.authorId);
        return {
          commentId: comment.id,
          videoId: comment.videoId,
          videoTitle: videos.get(comment.videoId)?.title ?? '',
          parentId: comment.parentId,
          authorHandle: author?.handle ?? null,
          authorDisplayName: author?.displayName ?? null,
          text: comment.content,
          createdAt: comment.createdAt.toISOString(),
          likes: comment.likeCount,
          hearted: comment.heartedAt !== null,
          pinned: comment.isPinned,
          moderationState: comment.moderationState,
          disclosure: comment.moderationDisclosure,
        };
      });
    return ok(pageOf(rows, after, limit));
  }

  async videos(scope: ExportScope, after: string | null, limit: number): Page<VideoExportRow> {
    const all = await this.deps.categories.findAll();
    if (isErr(all)) return all;
    const categories = new Map(all.value.map((category) => [category.id, category.slug]));
    const rows = [...this.videosOf(scope).values()]
      .filter((video) => onDays(viewDateOf(video.createdAt), scope.range))
      .sort(byCreated)
      .map((video) => ({
        videoId: video.id,
        title: video.title ?? '',
        description: video.description ?? '',
        tags: video.tags ?? [],
        category: (video.categoryId && categories.get(video.categoryId)) || null,
        visibility: video.visibility,
        status: video.status,
        durationMs: video.durationMs,
        views: video.viewsCount ?? 0,
        likes: video.likesCount ?? 0,
        dislikes: video.dislikesCount ?? 0,
        comments: video.commentsCount ?? 0,
        createdAt: video.createdAt.toISOString(),
        readyAt: video.readyAt?.toISOString() ?? null,
      }));
    return ok(pageOf(rows, after, limit));
  }
}
