import type { ServerResponse } from 'node:http';
import type { Logger } from '@kit/logger';
import {
  type Result,
  assertNever,
  err,
  ignore,
  isErr,
  isOk,
  ok,
  parseJson,
  tryCatch,
} from '@kit/result';
import { UserEventFrameSchema, WatchPartyDiscoveryEventSchema } from '@vp/api-contracts';
import type { CacheClient } from '@vp/core/ports';
import type { CacheUnavailable } from '@vp/errors';
import {
  PARTIES_WILDCARD_CHANNEL,
  SseMessageEnvelope,
  USER_WILDCARD_CHANNEL,
  VIDEO_WILDCARD_CHANNEL,
  channelType,
} from '@vp/events';
import type { PipelineMetrics } from '@vp/pipeline-metrics';
import { SseConnection, type SseFrame, type SseResync } from './sse-connection';
import {
  type SseRegisterFailure,
  type StreamLimit,
  sseStreamLimitReached,
  sseUnavailable,
} from './sse-failures';
import { userFrame, videoFrame } from './sse-frames';

function frameOf(channel: string, message: unknown, logger: Logger): SseFrame | undefined {
  const type = channelType(channel);
  switch (type) {
    case 'video': {
      const parsed = SseMessageEnvelope.safeParse(message);
      return parsed.success ? videoFrame(parsed.data) : undefined;
    }
    case 'user': {
      const parsed = UserEventFrameSchema.safeParse(message);
      if (parsed.success) return userFrame(parsed.data);

      logger.warn(
        { channel, issues: parsed.error.issues },
        'dropped a user event the contract does not know'
      );
      return undefined;
    }
    case 'parties': {
      const parsed = WatchPartyDiscoveryEventSchema.safeParse(message);
      if (parsed.success) return { event: parsed.data.type, data: parsed.data };

      logger.warn(
        { channel, issues: parsed.error.issues },
        'dropped a discovery event the contract does not know'
      );
      return undefined;
    }
    default:
      return assertNever(type, 'ChannelType');
  }
}

export interface SseHubOptions {
  cache: CacheClient;
  metrics: PipelineMetrics;
  maxConnectionsPerUser: number;
  maxPodConnections: number;
  heartbeatMs: number;
  idleTimeoutMs: number;
  maxPendingFrames: number;
  rememberedIds: number;
  logger: Logger;
}

export interface RegisterConnectionOptions {
  channel: string;
  userId?: string;
  /** Replaces the per-account budget a signed-in stream gets; a stream with neither has none. */
  limit?: StreamLimit;
  resync?: SseResync;
  rawResponse: ServerResponse;
}

export class SseHub {
  private readonly cache: CacheClient;
  private readonly metrics: PipelineMetrics;
  private readonly maxConnectionsPerUser: number;
  private readonly maxPodConnections: number;
  private readonly heartbeatMs: number;
  private readonly idleTimeoutMs: number;
  private readonly maxPendingFrames: number;
  private readonly rememberedIds: number;
  private readonly logger: Logger;

  private readonly connectionsByChannel = new Map<string, Set<SseConnection>>();
  private readonly slotCounts = new Map<string, number>();
  private readonly slotKeys = new Map<SseConnection, string>();
  private activeConnections = 0;
  private isSubscribed = false;
  private isClosed = false;
  private subscribing: Promise<Result<void, CacheUnavailable>> | undefined;
  private patternListener?: (pattern: string, channel: string, message: string) => void;

  constructor(options: SseHubOptions) {
    this.cache = options.cache;
    this.metrics = options.metrics;
    this.maxConnectionsPerUser = options.maxConnectionsPerUser;
    this.maxPodConnections = options.maxPodConnections;
    this.heartbeatMs = options.heartbeatMs;
    this.idleTimeoutMs = options.idleTimeoutMs;
    this.maxPendingFrames = options.maxPendingFrames;
    this.rememberedIds = options.rememberedIds;
    this.logger = options.logger;
  }

  /**
   * The hub claims to be subscribed only once both patterns are live, so a caller that retries
   * subscribes again instead of serving heartbeats onto a stream no event can ever reach.
   */
  async init(): Promise<Result<void, CacheUnavailable>> {
    if (this.isSubscribed || this.isClosed) return ok();

    this.subscribing ??= this.subscribe();
    const subscribed = await this.subscribing;
    if (isErr(subscribed)) this.subscribing = undefined;
    return subscribed;
  }

  private async subscribe(): Promise<Result<void, CacheUnavailable>> {
    this.patternListener = (_pattern: string, channel: string, rawMessage: string) => {
      this.handlePubSubMessage(channel, rawMessage);
    };

    const video = await this.cache.psubscribe(VIDEO_WILDCARD_CHANNEL, this.patternListener);
    if (isErr(video)) return video;

    const user = await this.cache.psubscribe(USER_WILDCARD_CHANNEL, this.patternListener);
    if (isErr(user)) return user;

    const parties = await this.cache.psubscribe(PARTIES_WILDCARD_CHANNEL, this.patternListener);
    if (isErr(parties)) return parties;

    this.isSubscribed = true;
    return ok();
  }

  register(options: RegisterConnectionOptions): Result<SseConnection, SseRegisterFailure> {
    if (this.isClosed) return err(sseUnavailable('SSE hub is shutting down'));
    if (this.activeConnections >= this.maxPodConnections) {
      return err(sseUnavailable('Maximum pod SSE connection limit reached'));
    }

    const { channel, userId, rawResponse, resync } = options;

    const limit: StreamLimit | undefined =
      options.limit ??
      (userId ? { subject: 'user', key: userId, max: this.maxConnectionsPerUser } : undefined);
    if (limit) {
      const currentCount = this.slotCounts.get(limit.key) ?? 0;
      if (currentCount >= limit.max) {
        return err(sseStreamLimitReached(limit.subject, limit.key, limit.max));
      }
      this.slotCounts.set(limit.key, currentCount + 1);
    }

    const connection = new SseConnection({
      channel,
      userId,
      resync,
      rawResponse,
      heartbeatMs: this.heartbeatMs,
      idleTimeoutMs: this.idleTimeoutMs,
      maxPendingFrames: this.maxPendingFrames,
      rememberedIds: this.rememberedIds,
    });

    let set = this.connectionsByChannel.get(channel);
    if (!set) {
      set = new Set();
      this.connectionsByChannel.set(channel, set);
    }
    set.add(connection);
    if (limit) this.slotKeys.set(connection, limit.key);
    this.activeConnections++;

    this.metrics.sseConnections.inc({ channel_type: channelType(channel) });

    connection.once('close', () => {
      this.unregister(connection);
    });

    return ok(connection);
  }

  private unregister(connection: SseConnection): void {
    const set = this.connectionsByChannel.get(connection.channel);
    if (set) {
      set.delete(connection);
      if (set.size === 0) {
        this.connectionsByChannel.delete(connection.channel);
      }
    }

    const slotKey = this.slotKeys.get(connection);
    if (slotKey !== undefined) {
      this.slotKeys.delete(connection);
      const current = this.slotCounts.get(slotKey) ?? 1;
      if (current <= 1) {
        this.slotCounts.delete(slotKey);
      } else {
        this.slotCounts.set(slotKey, current - 1);
      }
    }

    this.activeConnections = Math.max(0, this.activeConnections - 1);

    this.metrics.sseConnections.dec({ channel_type: channelType(connection.channel) });
  }

  private handlePubSubMessage(channel: string, rawMessage: string): void {
    const set = this.connectionsByChannel.get(channel);
    if (!set || set.size === 0) return;

    const decoded = parseJson(rawMessage);
    if (!isOk(decoded)) return;

    const frame = frameOf(channel, decoded.value, this.logger);
    if (!frame) return;

    for (const conn of set) {
      ignore(
        tryCatch(
          () => conn.onLiveEvent(frame),
          () => null
        ),
        'one connection that cannot take the event must not cost the others theirs'
      );
    }
  }

  getActiveConnectionCount(): number {
    return this.activeConnections;
  }

  getUserConnectionCount(userId: string): number {
    return this.slotCounts.get(userId) ?? 0;
  }

  async close(): Promise<void> {
    if (this.isClosed) return;
    this.isClosed = true;

    for (const set of this.connectionsByChannel.values()) {
      for (const conn of set) {
        conn.close();
      }
    }
    this.connectionsByChannel.clear();
    this.slotCounts.clear();
    this.slotKeys.clear();
    this.activeConnections = 0;

    if (this.patternListener) {
      ignore(
        await this.cache.punsubscribe(VIDEO_WILDCARD_CHANNEL, this.patternListener),
        'a cache that is already gone has nothing to unsubscribe from'
      );
      ignore(
        await this.cache.punsubscribe(USER_WILDCARD_CHANNEL, this.patternListener),
        'a cache that is already gone has nothing to unsubscribe from'
      );
      ignore(
        await this.cache.punsubscribe(PARTIES_WILDCARD_CHANNEL, this.patternListener),
        'a cache that is already gone has nothing to unsubscribe from'
      );
      this.patternListener = undefined;
      this.isSubscribed = false;
    }
  }
}
