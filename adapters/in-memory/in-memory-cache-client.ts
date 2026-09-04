import type { MessageListener, PatternMessageListener } from '@vp/core/ports';
import { CacheClient } from '@vp/core/ports';

export interface PublishedMessage {
  channel: string;
  message: string;
  publishedAt: Date;
}

export class InMemoryCacheClient extends CacheClient {
  private readonly listeners = new Map<string, Set<MessageListener>>();
  private readonly patternListeners = new Map<string, Set<PatternMessageListener>>();
  readonly publishedMessages: PublishedMessage[] = [];
  private isHealthy = true;

  setHealthy(healthy: boolean): void {
    this.isHealthy = healthy;
  }

  async checkHealth(): Promise<boolean> {
    return this.isHealthy;
  }

  async ping(): Promise<string> {
    if (!this.isHealthy) {
      throw new Error('Redis connection failed');
    }
    return 'PONG';
  }

  async publish(channel: string, message: string): Promise<number> {
    this.publishedMessages.push({
      channel,
      message,
      publishedAt: new Date(),
    });

    let count = 0;

    // Direct channel listeners
    const channelListeners = this.listeners.get(channel);
    if (channelListeners && channelListeners.size > 0) {
      for (const listener of channelListeners) {
        try {
          listener(channel, message);
          count++;
        } catch {
          // Safe listener execution
        }
      }
    }

    // Pattern listeners (e.g. 'video:*' -> matches 'video:123')
    for (const [pattern, set] of this.patternListeners.entries()) {
      if (this.matchesPattern(pattern, channel)) {
        for (const listener of set) {
          try {
            listener(pattern, channel, message);
            count++;
          } catch {
            // Safe listener execution
          }
        }
      }
    }

    return count;
  }

  subscribe(channel: string, listener: MessageListener): void {
    let set = this.listeners.get(channel);
    if (!set) {
      set = new Set();
      this.listeners.set(channel, set);
    }
    set.add(listener);
  }

  unsubscribe(channel: string, listener?: MessageListener): void {
    if (!listener) {
      this.listeners.delete(channel);
      return;
    }
    const set = this.listeners.get(channel);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(channel);
      }
    }
  }

  psubscribe(pattern: string, listener: PatternMessageListener): void {
    let set = this.patternListeners.get(pattern);
    if (!set) {
      set = new Set();
      this.patternListeners.set(pattern, set);
    }
    set.add(listener);
  }

  punsubscribe(pattern: string, listener?: PatternMessageListener): void {
    if (!listener) {
      this.patternListeners.delete(pattern);
      return;
    }
    const set = this.patternListeners.get(pattern);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.patternListeners.delete(pattern);
      }
    }
  }

  clear(): void {
    this.publishedMessages.length = 0;
  }

  clearListeners(): void {
    this.listeners.clear();
    this.patternListeners.clear();
  }

  async close(): Promise<void> {
    this.clear();
    this.clearListeners();
  }

  private matchesPattern(pattern: string, channel: string): boolean {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const regex = new RegExp(`^${escaped}$`);
    return regex.test(channel);
  }
}
