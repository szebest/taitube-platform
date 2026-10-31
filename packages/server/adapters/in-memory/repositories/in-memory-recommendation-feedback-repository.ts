import type {
  ChannelRepositoryPort,
  ListRecommendationFeedbackOptions,
  RecommendationFeedbackRepositoryPort,
  VideoRepository,
} from '@vp/core/repositories';
import {
  type HiddenFeedback,
  type NewRecommendationFeedback,
  RECOMMENDATION_FEEDBACK_LIMIT,
  type RecommendationFeedback,
  type RecommendationFeedbackEntry,
  toChannelCard,
} from '@vp/domain';
import type { DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { type Result, ok, unwrapOr } from '@vp/result';
import { byKeysetDesc, isKeysetBefore } from './keyset';
import { watchableVideo } from './watchable-video';

interface FeedbackLookups {
  videosRepo: Pick<VideoRepository, 'findById'>;
  channelsRepo: Pick<ChannelRepositoryPort, 'findById' | 'findByUserId'>;
}

const keysetOf = ({ createdAt, id }: NewRecommendationFeedback) => ({ sort: createdAt, tie: id });

const targetOf = (entry: RecommendationFeedback): string =>
  entry.kind === 'not_interested' ? `video/${entry.videoId}` : `channel/${entry.channelId}`;

export class InMemoryRecommendationFeedbackRepository
  implements RecommendationFeedbackRepositoryPort
{
  private readonly rows = new Map<string, NewRecommendationFeedback>();

  constructor(private readonly lookups: FeedbackLookups) {}

  async put(
    entry: NewRecommendationFeedback
  ): Promise<Result<RecommendationFeedback, DatabaseUnavailable>> {
    const key = this.key(entry.userId, targetOf(entry));
    const stored = this.rows.get(key);
    if (stored) return ok(this.withoutOwner(stored));

    this.rows.set(key, { ...entry });
    const stale = this.of(entry.userId)
      .filter((row) => row.id !== entry.id)
      .slice(RECOMMENDATION_FEEDBACK_LIMIT - 1);
    for (const row of stale) this.rows.delete(this.key(row.userId, targetOf(row)));
    return ok(this.withoutOwner(entry));
  }

  async list(
    viewer: UserContext,
    { kind, cursor, limit }: ListRecommendationFeedbackOptions
  ): Promise<Result<RecommendationFeedbackEntry[], DatabaseUnavailable>> {
    const after = cursor && { sort: cursor.createdAt, tie: cursor.id };
    const page = this.of(viewer.id)
      .filter((row) => (kind === null || row.kind === kind) && isKeysetBefore(keysetOf(row), after))
      .slice(0, limit + 1);

    return ok(await Promise.all(page.map((row) => this.entryOf(viewer, row))));
  }

  async hiddenOf(userId: string): Promise<Result<HiddenFeedback, DatabaseUnavailable>> {
    const rows = this.of(userId);
    return ok({
      videoIds: new Set(
        rows.flatMap((row) => (row.kind === 'not_interested' ? [row.videoId] : []))
      ),
      channelIds: new Set(
        rows.flatMap((row) => (row.kind === 'hide_channel' ? [row.channelId] : []))
      ),
    });
  }

  async remove(userId: string, id: string): Promise<Result<boolean, DatabaseUnavailable>> {
    const found = this.of(userId).find((row) => row.id === id);
    return ok(found ? this.rows.delete(this.key(userId, targetOf(found))) : false);
  }

  clear(): void {
    this.rows.clear();
  }

  private async entryOf(
    viewer: UserContext,
    row: NewRecommendationFeedback
  ): Promise<RecommendationFeedbackEntry> {
    const base = this.withoutOwner(row);
    if (row.kind === 'not_interested') {
      const watchable = await watchableVideo(this.lookups, viewer, row.videoId);
      return { ...base, video: watchable?.video ?? null, channel: watchable?.channel ?? null };
    }
    const channel = unwrapOr(await this.lookups.channelsRepo.findById(row.channelId), null);
    return { ...base, video: null, channel: channel ? toChannelCard(channel) : null };
  }

  private withoutOwner({
    userId: _userId,
    ...feedback
  }: NewRecommendationFeedback): RecommendationFeedback {
    return feedback;
  }

  private of(userId: string): NewRecommendationFeedback[] {
    return [...this.rows.values()]
      .filter((row) => row.userId === userId)
      .sort((a, b) => byKeysetDesc(keysetOf(a), keysetOf(b)));
  }

  private key(userId: string, target: string): string {
    return `${userId}/${target}`;
  }
}
