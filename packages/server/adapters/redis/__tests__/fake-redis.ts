import type { Redis } from 'ioredis';
import { VIEW_BUFFER_SCRIPTS } from '../redis-view-buffer.adapter';

type Listener = (...args: string[]) => void;

interface PipelineOp {
  run(): void;
}

export class FakeRedis {
  readonly strings = new Map<string, string>();
  readonly hashes = new Map<string, Map<string, string>>();
  readonly sets = new Map<string, Set<string>>();
  /** HyperLogLogs, held exactly: a double that never collides is what makes counts assertable. */
  readonly sketches = new Map<string, Set<string>>();
  readonly ttls = new Map<string, number>();
  readonly published: Array<{ channel: string; message: string }> = [];
  readonly subscribedChannels = new Set<string>();
  readonly subscribedPatterns = new Set<string>();

  quitCalls = 0;
  disconnectCalls = 0;
  failNextQuit = false;

  private readonly listeners = new Map<string, Listener[]>();
  private readonly duplicates: FakeRedis[] = [];

  asRedis(): Redis {
    return this as unknown as Redis;
  }

  duplicate(): Redis {
    const copy = new FakeRedis();
    this.duplicates.push(copy);
    return copy.asRedis();
  }

  lastDuplicate(): FakeRedis | undefined {
    return this.duplicates.at(-1);
  }

  on(event: string, listener: Listener): this {
    const existing = this.listeners.get(event) ?? [];
    existing.push(listener);
    this.listeners.set(event, existing);
    return this;
  }

  emit(event: string, ...args: string[]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(...args);
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async publish(channel: string, message: string): Promise<number> {
    this.published.push({ channel, message });
    return this.subscribedChannels.has(channel) ? 1 : 0;
  }

  async subscribe(channel: string): Promise<number> {
    this.subscribedChannels.add(channel);
    return this.subscribedChannels.size;
  }

  async unsubscribe(channel: string): Promise<number> {
    this.subscribedChannels.delete(channel);
    return this.subscribedChannels.size;
  }

  async psubscribe(pattern: string): Promise<number> {
    this.subscribedPatterns.add(pattern);
    return this.subscribedPatterns.size;
  }

  async punsubscribe(pattern: string): Promise<number> {
    this.subscribedPatterns.delete(pattern);
    return this.subscribedPatterns.size;
  }

  async get(key: string): Promise<string | null> {
    return this.strings.get(key) ?? null;
  }

  async set(key: string, value: string, mode?: string, ttlSeconds?: number): Promise<'OK'> {
    this.strings.set(key, value);
    if (mode === 'EX' && ttlSeconds !== undefined) this.ttls.set(key, ttlSeconds);
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const existed = this.strings.delete(key);
    this.hashes.delete(key);
    this.sets.delete(key);
    this.sketches.delete(key);
    this.ttls.delete(key);
    return existed ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    return this.strings.has(key) || this.hashes.has(key) || this.sets.has(key) ? 1 : 0;
  }

  /** Stands in for the scripts this package sends; any other script is a spec that needs one. */
  async eval(script: string, numKeys: number, ...args: Array<string | number>): Promise<unknown> {
    const keys = args.slice(0, numKeys).map(String);
    const argv = args.slice(numKeys).map(String);

    switch (script) {
      case VIEW_BUFFER_SCRIPTS.record:
        return this.recordView(keys, argv);
      case VIEW_BUFFER_SCRIPTS.snapshot:
        return this.snapshotViews(keys, argv);
      case VIEW_BUFFER_SCRIPTS.release:
        return this.releaseViews(keys, argv);
      default:
        throw new Error('FakeRedis has no stand-in for this script');
    }
  }

  private recordView(keys: string[], argv: string[]): number {
    const [dedupKey = '', bufferKey = ''] = keys;
    const [viewer = '', ttl = '0', viewsField = '', watchField = '', watch = '0'] = argv;
    const sketch = this.sketches.get(dedupKey) ?? new Set<string>();
    const added = sketch.has(viewer) ? 0 : 1;
    sketch.add(viewer);
    this.sketches.set(dedupKey, sketch);
    this.ttls.set(dedupKey, Number(ttl));
    if (added === 1) {
      void this.hincrby(bufferKey, viewsField, 1);
      void this.hincrby(bufferKey, watchField, Number(watch));
    }
    return added;
  }

  private snapshotViews(keys: string[], argv: string[]): string | null {
    const [pointer = '', buffer = '', batchKey = ''] = keys;
    const [batchId = ''] = argv;
    const pending = this.strings.get(pointer);
    if (pending !== undefined) return pending;
    const hash = this.hashes.get(buffer);
    if (!hash) return null;
    this.hashes.delete(buffer);
    this.hashes.set(batchKey, hash);
    this.strings.set(pointer, batchId);
    return batchId;
  }

  private releaseViews(keys: string[], argv: string[]): number {
    const [pointer = '', batchKey = ''] = keys;
    const [batchId = ''] = argv;
    if (this.strings.get(pointer) !== batchId) return 0;
    this.strings.delete(pointer);
    this.hashes.delete(batchKey);
    return 1;
  }

  async expire(key: string, ttlSeconds: number): Promise<number> {
    this.ttls.set(key, ttlSeconds);
    return 1;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return Object.fromEntries(this.hashes.get(key) ?? new Map());
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hset(key: string, fieldOrMap: string | Record<string, string>, value?: string) {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    if (typeof fieldOrMap === 'string') {
      hash.set(fieldOrMap, value ?? '');
    } else {
      for (const [field, entry] of Object.entries(fieldOrMap)) hash.set(field, entry);
    }
    this.hashes.set(key, hash);
    return hash.size;
  }

  async hincrby(key: string, field: string, delta: number): Promise<number> {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    const next = Number.parseInt(hash.get(field) ?? '0', 10) + delta;
    hash.set(field, String(next));
    this.hashes.set(key, hash);
    return next;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key) ?? new Set<string>();
    for (const member of members) set.add(member);
    this.sets.set(key, set);
    return set.size;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const member of members) removed += set.delete(member) ? 1 : 0;
    if (set.size === 0) this.sets.delete(key);
    return removed;
  }

  async sismember(key: string, member: string): Promise<number> {
    return this.sets.get(key)?.has(member) ? 1 : 0;
  }

  pipeline(): FakePipeline {
    return new FakePipeline(this);
  }

  multi(): FakePipeline {
    return new FakePipeline(this);
  }

  async quit(): Promise<'OK'> {
    this.quitCalls += 1;
    if (this.failNextQuit) {
      this.failNextQuit = false;
      throw new Error('quit refused');
    }
    return 'OK';
  }

  disconnect(): void {
    this.disconnectCalls += 1;
  }
}

export class FakePipeline {
  private readonly ops: PipelineOp[] = [];

  constructor(private readonly redis: FakeRedis) {}

  private queue(run: () => void): this {
    this.ops.push({ run });
    return this;
  }

  del(key: string): this {
    return this.queue(() => void this.redis.del(key));
  }

  sadd(key: string, ...members: string[]): this {
    return this.queue(() => void this.redis.sadd(key, ...members));
  }

  srem(key: string, ...members: string[]): this {
    return this.queue(() => void this.redis.srem(key, ...members));
  }

  expire(key: string, ttlSeconds: number): this {
    return this.queue(() => void this.redis.expire(key, ttlSeconds));
  }

  hset(key: string, fieldOrMap: string | Record<string, string>, value?: string): this {
    return this.queue(() => void this.redis.hset(key, fieldOrMap, value));
  }

  hincrby(key: string, field: string, delta: number): this {
    return this.queue(() => void this.redis.hincrby(key, field, delta));
  }

  async exec(): Promise<Array<[Error | null, unknown]>> {
    for (const op of this.ops) op.run();
    return this.ops.map(() => [null, 'OK'] as [Error | null, unknown]);
  }
}
