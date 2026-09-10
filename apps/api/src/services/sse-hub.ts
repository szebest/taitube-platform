import type { ServerResponse } from 'node:http';
import type { CacheClient } from '@vp/core/ports';
import { ErrorCodes, PermanentError, TransientError } from '@vp/errors';
import { SseMessageEnvelope, USER_WILDCARD_CHANNEL, VIDEO_WILDCARD_CHANNEL } from '@vp/events';
import { getMetrics } from '@vp/observability';
import { SseConnection } from './sse-connection.js';

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

  register(options: RegisterConnectionOptions): SseConnection {
    if (this.isClosed) {
      throw new TransientError(ErrorCodes.STORAGE_UNAVAILABLE, 'SSE hub is shutting down');
    }

    if (this.activeConnections >= this.maxPodConnections) {
      throw new TransientError(
        ErrorCodes.STORAGE_UNAVAILABLE,
        'Maximum pod SSE connection limit reached'
      );
    }

    const { channel, userId, rawResponse } = options;

    if (userId) {
      const currentCount = this.userConnectionCounts.get(userId) ?? 0;
      if (currentCount >= this.maxConnectionsPerUser) {
        throw new PermanentError(
          ErrorCodes.RATE_LIMITED,
          `Maximum active SSE streams (${this.maxConnectionsPerUser}) exceeded for user`
        );
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

    return connection;
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

    let envelope: SseMessageEnvelope;
    try {
      const parsedJson = JSON.parse(rawMessage);
      const parsed = SseMessageEnvelope.safeParse(parsedJson);
      if (!parsed.success) {
        return;
      }
      envelope = parsed.data;
    } catch {
      return;
    }

    for (const conn of set) {
      try {
        conn.onLiveEvent(envelope);
      } catch {
        // Safe dispatch
      }
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
      if (this.patternListener) {
        await Promise.resolve(
          this.cache.punsubscribe(VIDEO_WILDCARD_CHANNEL, this.patternListener)
        ).catch(() => {});
        await Promise.resolve(
          this.cache.punsubscribe(USER_WILDCARD_CHANNEL, this.patternListener)
        ).catch(() => {});
      } else {
        await Promise.resolve(this.cache.punsubscribe(VIDEO_WILDCARD_CHANNEL)).catch(() => {});
        await Promise.resolve(this.cache.punsubscribe(USER_WILDCARD_CHANNEL)).catch(() => {});
      }
      this.isSubscribed = false;
    }
  }
}
