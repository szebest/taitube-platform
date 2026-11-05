import type { LiveChatMessageView, LiveOverlayView, LiveStreamPublicView } from '@vp/api-contracts';
import type { LiveChatRepositoryPort, SubscriptionRepositoryPort } from '@vp/core/repositories';
import type { Channel, LiveStream } from '@vp/domain';
import { type LiveStreamNotFound, liveStreamNotFound } from '@vp/domain-rules';
import type { CdnBase } from '@vp/env-schema';
import type { CacheUnavailable, DatabaseUnavailable } from '@vp/errors';
import type { UserContext } from '@vp/permissions';
import { err, isErr, map, ok, type Result, unwrapOr } from '@vp/result';
import { type LiveAccessDeps, type ReadLiveFailure, readLive } from './live-access';
import { toLiveChatMessageView, toLiveStreamView } from './live-views';

export interface LiveServiceDeps extends LiveAccessDeps {
  liveChat: LiveChatRepositoryPort;
  subscriptions: Pick<SubscriptionRepositoryPort, 'getSubscriberCount'>;
  viewers: (liveStreamId: string) => Promise<Result<number, CacheUnavailable>>;
  cdn: CdnBase;
  limits: { list: number; replay: number };
}

export interface ReplayRange {
  fromMs: number;
  toMs: number;
}

export class LiveService {
  constructor(private readonly deps: LiveServiceDeps) {}

  async list(
    limit?: number
  ): Promise<Result<{ items: LiveStreamPublicView[] }, DatabaseUnavailable>> {
    const { liveStreams, channels } = this.deps;
    const live = await liveStreams.listLive(
      Math.min(limit ?? this.deps.limits.list, this.deps.limits.list)
    );
    if (isErr(live)) return live;

    const items: LiveStreamPublicView[] = [];
    for (const stream of live.value) {
      const channel = await channels.findById(stream.channelId);
      if (isErr(channel)) return channel;
      if (channel.value) items.push(await this.view(stream, channel.value, false));
    }
    return ok({ items });
  }

  async get(
    viewer: UserContext | null,
    liveStreamId: string
  ): Promise<Result<LiveStreamPublicView, ReadLiveFailure>> {
    const watchable = await readLive(this.deps, viewer, liveStreamId);
    if (isErr(watchable)) return watchable;
    const { stream, channel, video } = watchable.value;
    return ok(await this.view(stream, channel, video.status === 'READY'));
  }

  /** A browser source holds the overlay token from the studio, and loads before the stream starts. */
  async overlay(
    token: string
  ): Promise<Result<LiveOverlayView, LiveStreamNotFound | DatabaseUnavailable>> {
    const { liveStreams, channels, subscriptions } = this.deps;
    const stream = await liveStreams.findByToken('overlay', token);
    if (isErr(stream)) return stream;
    const channel = stream.value && (await channels.findById(stream.value.channelId));
    if (channel && isErr(channel)) return channel;
    if (!(stream.value && channel?.value)) return err(liveStreamNotFound('overlay'));

    const subscriberCount = await subscriptions.getSubscriberCount(channel.value.id);
    if (isErr(subscriberCount)) return subscriberCount;
    return ok({
      stream: await this.view(stream.value, channel.value, false),
      subscriberCount: subscriberCount.value,
    });
  }

  async replay(
    viewer: UserContext | null,
    liveStreamId: string,
    range: ReplayRange
  ): Promise<Result<{ items: LiveChatMessageView[] }, ReadLiveFailure>> {
    const watchable = await readLive(this.deps, viewer, liveStreamId);
    if (isErr(watchable)) return watchable;
    const lines = await this.deps.liveChat.listByOffset(liveStreamId, {
      ...range,
      limit: this.deps.limits.replay,
    });
    return map(lines, (found) => ({ items: found.map(toLiveChatMessageView) }));
  }

  /** A count the cache cannot give reads as nobody watching, not as a failed page. */
  private async view(
    stream: LiveStream,
    channel: Channel,
    recordingReady: boolean
  ): Promise<LiveStreamPublicView> {
    const viewers = stream.status === 'LIVE' ? unwrapOr(await this.deps.viewers(stream.id), 0) : 0;
    return toLiveStreamView({ stream, channel, viewers, recordingReady }, this.deps.cdn);
  }
}
