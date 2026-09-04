import { CacheClient } from '@vp/core/ports';

export interface PublishedMessage {
  channel: string;
  message: string;
  publishedAt: Date;
}

export class InMemoryCacheClient extends CacheClient {
  private readonly listeners = new Map<string, Set<(message: string) => void>>();
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

    const channelListeners = this.listeners.get(channel);
    if (!channelListeners || channelListeners.size === 0) {
      return 0;
    }

    for (const listener of channelListeners) {
      try {
        listener(message);
      } catch {
        // Safe listener execution
      }
    }

    return channelListeners.size;
  }

  subscribe(channel: string, listener: (message: string) => void): void {
    let set = this.listeners.get(channel);
    if (!set) {
      set = new Set();
      this.listeners.set(channel, set);
    }
    set.add(listener);
  }

  unsubscribe(channel: string, listener: (message: string) => void): void {
    const set = this.listeners.get(channel);
    if (set) {
      set.delete(listener);
    }
  }

  async close(): Promise<void> {
    this.listeners.clear();
  }
}
