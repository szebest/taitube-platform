import {
  CacheClient,
  type MessageListener,
  type PatternMessageListener,
} from '@kit/ports';
import { ok } from '@kit/result';

const toExpression = (pattern: string): RegExp =>
  new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);

export class ShelfCache extends CacheClient {
  private readonly values = new Map<string, string>();
  private readonly channels = new Map<string, Set<MessageListener>>();
  private readonly patterns = new Map<string, Set<PatternMessageListener>>();

  checkHealth = async () => ok();
  ping = async () => ok('PONG');
  close = async () => ok();

  get = async (key: string) => ok(this.values.get(key) ?? null);

  set = async (key: string, value: string) => {
    this.values.set(key, value);
    return ok();
  };

  del = async (...keys: string[]) => {
    for (const key of keys) this.values.delete(key);
    return ok();
  };

  subscribe = async (channel: string, listener: MessageListener) => {
    this.channels.set(channel, new Set(this.channels.get(channel)).add(listener));
    return ok();
  };

  unsubscribe = async (channel: string, listener?: MessageListener) => {
    const remaining = new Set(this.channels.get(channel));
    if (listener) remaining.delete(listener);
    else remaining.clear();
    this.channels.set(channel, remaining);
    return ok();
  };

  psubscribe = async (pattern: string, listener: PatternMessageListener) => {
    this.patterns.set(pattern, new Set(this.patterns.get(pattern)).add(listener));
    return ok();
  };

  punsubscribe = async (pattern: string, listener?: PatternMessageListener) => {
    const remaining = new Set(this.patterns.get(pattern));
    if (listener) remaining.delete(listener);
    else remaining.clear();
    this.patterns.set(pattern, remaining);
    return ok();
  };

  publish = async (channel: string, message: string) => {
    const direct = [...(this.channels.get(channel) ?? [])];
    for (const listener of direct) listener(channel, message);
    const matching = [...this.patterns].filter(([pattern]) => toExpression(pattern).test(channel));
    for (const [pattern, listeners] of matching) {
      for (const listener of listeners) listener(pattern, channel, message);
    }
    return ok(direct.length);
  };
}
