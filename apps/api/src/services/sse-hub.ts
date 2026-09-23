import type { ServerResponse } from 'node:http';
import type { CacheClient } from '@vp/core/ports';
import { SseMessageEnvelope, USER_WILDCARD_CHANNEL, VIDEO_WILDCARD_CHANNEL } from '@vp/events';
import { getMetrics } from '@vp/observability';
import { type Result, err, isOk, ok, tryCatch } from '@vp/result';
import { SseConnection } from './sse-connection';
import { type SseRegisterFailure, sseStreamLimitReached, sseUnavailable } from './sse-failures';

export interface SseHubOptions {
  cache: CacheClient;
  maxConnectionsPerUser?: number;
  maxPodConnections?: number;
  heartbeatMs?: number;
  idleTimeoutMs?: number;
}

export interface RegisterConnectionOptions {
  channel: string;
  userId?: string;
  rawResponse: ServerResponse;
}

export class SseHub {
  private readonly cache: CacheClient;
  private readonly maxConnectionsPerUser: number;
  private readonly maxPodConnections: number;
  private readonly heartbeatMs: number;
  private readonly idleTimeoutMs: number;

  private readonly connectionsByChannel = new Map<string, Set<SseConnection>>();
  private readonly userConnectionCounts = new Map<string, number>();
  private activeConnections = 0;
  private isSubscribed = false;
  private isClosed = false;
  private patternListener?: (pattern: string, channel: string, message: string) => void;

  constructor(options: SseHubOptions) {
    this.cache = options.cache;
    this.maxConnectionsPerUser =
      options.maxConnectionsPerUser ?? Number(process.env['SSE_MAX_PER_USER'] || '20');
    this.maxPodConnections =
      options.maxPodConnections ?? Number(process.env['SSE_MAX_POD_CONNECTIONS'] || '5000');
    this.heartbeatMs = options.heartbeatMs ?? 15_000;
    this.idleTimeoutMs = options.idleTimeoutMs ?? 30 * 60 * 1000;
  }

  async init(): Promise<void> {
    if (this.isSubscribed || this.isClosed) return;
    this.isSubscribed = true;

    this.patternListener = (_pattern: string, channel: string, rawMessage: string) => {
      this.handlePubSubMessage(channel, rawMessage);
    };

    await this.cache.psubscribe(VIDEO_WILDCARD_CHANNEL, this.patternListener);
    await this.cache.psubscribe(USER_WILDCARD_CHANNEL, this.patternListener);
  }

  register(options: RegisterConnectionOptions): Result<SseConnection, SseRegisterFailure> {
    if (this.isClosed) return err(sseUnavailable('SSE hub is shutting down'));
    if (this.activeConnections >= this.maxPodConnections) {
      return err(sseUnavailable('Maximum pod SSE connection limit reached'));
    }

    const { channel, userId, rawResponse } = options;

    if (userId) {
      const currentCount = this.userConnectionCounts.get(userId) ?? 0;
      if (currentCount >= this.maxConnectionsPerUser) {
        return err(sseStreamLimitReached(userId, this.maxConnectionsPerUser));
      }
      this.userConnectionCounts.set(userId, currentCount + 1);
    }

    const connection = new SseConnection({
      channel,
      userId,
      rawResponse,
      heartbeatMs: this.heartbeatMs,
      idleTimeoutMs: this.idleTimeoutMs,
    });

    let set = this.connectionsByChannel.get(channel);
    if (!set) {
      set = new Set();
      this.connectionsByChannel.set(channel, set);
    }
    set.add(connection);
    this.activeConnections++;

    // Increment SSE connections metric (channel_type = 'video' or 'user')
    const channelType = channel.startsWith('video:') ? 'video' : 'user';
    getMetrics().sseConnections.inc({ channel_type: channelType });

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

    if (connection.userId) {
      const current = this.userConnectionCounts.get(connection.userId) ?? 1;
      if (current <= 1) {
        this.userConnectionCounts.delete(connection.userId);
      } else {
        this.userConnectionCounts.set(connection.userId, current - 1);
      }
    }

    this.activeConnections = Math.max(0, this.activeConnections - 1);

    // Decrement SSE connections metric
    const channelType = connection.channel.startsWith('video:') ? 'video' : 'user';
    getMetrics().sseConnections.dec({ channel_type: channelType });
  }

  private handlePubSubMessage(channel: string, rawMessage: string): void {
    const set = this.connectionsByChannel.get(channel);
    if (!set || set.size === 0) return;

    const decoded = tryCatch(
      () => SseMessageEnvelope.safeParse(JSON.parse(rawMessage)),
      () => null
    );
    if (!isOk(decoded)) return;

    const parsed = decoded.value;
    if (!parsed.success) return;

    const envelope: SseMessageEnvelope = parsed.data;
    for (const conn of set) {
      // One connection that cannot take the event must not cost the others theirs.
      tryCatch(
        () => conn.onLiveEvent(envelope),
        () => null
      );
    }
  }

  getActiveConnectionCount(): number {
    return this.activeConnections;
  }

  getUserConnectionCount(userId: string): number {
    return this.userConnectionCounts.get(userId) ?? 0;
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
    this.userConnectionCounts.clear();
    this.activeConnections = 0;

    if (this.isSubscribed) {
      // A cache that is already gone has nothing to unsubscribe from, so its failure is dropped.
      await this.cache.punsubscribe(VIDEO_WILDCARD_CHANNEL, this.patternListener);
      await this.cache.punsubscribe(USER_WILDCARD_CHANNEL, this.patternListener);
      this.isSubscribed = false;
    }
  }
}
