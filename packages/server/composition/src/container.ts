import { type Result, err, fromPromise, ignore, isErr, ok } from '@vp/result';
import type { Token } from './token';

export interface Startable {
  start(): Promise<Result<void, unknown>>;
}

export interface Lifecycle<T> {
  start?: (value: T) => Promise<Result<void, unknown>>;
  dispose?: (value: T) => Promise<Result<void, unknown> | void> | Result<void, unknown> | void;
}

export interface Closable {
  close(): Promise<Result<void, unknown> | void>;
}

export const closeOnDispose: Lifecycle<Closable> = { dispose: (resource) => resource.close() };

export interface TokenFailed {
  readonly token: string;
  readonly cause: unknown;
}

/**
 * Why `start()` did not finish: a start that failed, or a `dispose()` that arrived first - a
 * `SIGTERM` during boot - which is a shutdown already in hand, not a boot failure to report.
 */
export type StartupFailed =
  | ({ readonly type: 'failed' } & TokenFailed)
  | { readonly type: 'interrupted' };

export interface ShutdownFailed {
  readonly failed: readonly TokenFailed[];
}

export class DisposeFailed extends Error {
  constructor(readonly failure: ShutdownFailed) {
    super(`disposers failed: ${failure.failed.map(({ token }) => token).join(', ')}`);
    this.name = 'DisposeFailed';
  }
}

type Factory<T> = (c: Container) => T;

type Key = { readonly name: string };

interface Constructed {
  readonly name: string;
  readonly value: unknown;
  readonly lifecycle: Lifecycle<unknown> | undefined;
}

const toCause = (cause: unknown): unknown => cause;

const AsyncFunction = (async () => {}).constructor;

function isThenable(value: unknown): boolean {
  return typeof (value as { then?: unknown } | null)?.then === 'function';
}

export class Container {
  private readonly providers = new Map<Key, [Factory<unknown>, Lifecycle<unknown>?]>();
  private readonly overrides = new Map<Key, unknown>();
  private readonly values = new Map<Key, unknown>();
  private readonly constructed: Constructed[] = [];
  private readonly path: Key[] = [];
  private disposal: Promise<Result<void, ShutdownFailed>> | undefined;
  private starting: Promise<Result<void, StartupFailed>> | undefined;
  private pendingDisposer: string | undefined;
  private readonly startedTokens: string[] = [];

  provide<T, V extends T = T>(t: Token<T>, make: Factory<V>, lifecycle?: Lifecycle<V>): this {
    if (make instanceof AsyncFunction) {
      throw new Error(`${t.name}: a factory is synchronous; I/O belongs in its start()`);
    }
    this.refuseResolved(t, 'provide');
    this.providers.set(t, [make, lifecycle as Lifecycle<unknown> | undefined]);
    return this;
  }

  override<T>(t: Token<T>, value: T): this {
    this.refuseResolved(t, 'override');
    this.overrides.set(t, value);
    return this;
  }

  get<T>(t: Token<T>): T {
    if (this.values.has(t)) return this.values.get(t) as T;
    if (this.overrides.has(t)) return this.remember(t, this.overrides.get(t));
    if (this.path.includes(t)) {
      throw new Error(`Cycle: ${[...this.path, t].map((step) => step.name).join(' → ')}`);
    }

    const provider = this.providers.get(t);
    if (!provider) throw new Error(`No provider for ${t.name}`);

    this.path.push(t);
    let value: T;
    try {
      value = this.build(t, provider[0]);
    } finally {
      this.path.pop();
    }

    this.constructed.push({ name: t.name, value, lifecycle: provider[1] });
    return this.remember(t, value);
  }

  start(): Promise<Result<void, StartupFailed>> {
    this.starting ??= this.startAll();
    return this.starting;
  }

  /** What has started so far, in the order it started. */
  started(): readonly string[] {
    return [...this.startedTokens];
  }

  /** A dispose during `start()` lets the start in flight finish, then starts nothing more. */
  dispose(): Promise<Result<void, ShutdownFailed>> {
    this.disposal ??= this.afterStart().then(() => this.disposeAll());
    return this.disposal;
  }

  private async afterStart(): Promise<void> {
    if (this.starting) ignore(await this.starting, 'the disposal that follows reports its own');
  }

  private async startAll(): Promise<Result<void, StartupFailed>> {
    for (const { name, value, lifecycle } of [...this.constructed]) {
      if (this.disposal) return err({ type: 'interrupted' });

      const start = lifecycle?.start;
      if (!start) continue;

      const started = await fromPromise(() => start(value), toCause);
      const failure = isErr(started) ? started.error : !started.value.ok && started.value.error;
      if (failure !== false) {
        this.disposal ??= this.disposeAll();
        ignore(await this.disposal, 'the start failure is what the caller acts on');
        return err({ type: 'failed', token: name, cause: failure });
      }
      this.startedTokens.push(name);
    }
    return this.disposal ? err({ type: 'interrupted' }) : ok();
  }

  disposing(): string | undefined {
    return this.pendingDisposer;
  }

  private async disposeAll(): Promise<Result<void, ShutdownFailed>> {
    const failed: TokenFailed[] = [];

    for (const { name, value, lifecycle } of [...this.constructed].reverse()) {
      const dispose = lifecycle?.dispose;
      if (!dispose) continue;

      this.pendingDisposer = name;
      const settled = await fromPromise(async () => dispose(value), toCause);
      this.pendingDisposer = undefined;

      if (isErr(settled)) failed.push({ token: name, cause: settled.error });
      else if (settled.value && !settled.value.ok) {
        failed.push({ token: name, cause: settled.value.error });
      }
    }

    return failed.length === 0 ? ok() : err({ failed });
  }

  private build<T>(t: Token<T>, make: Factory<unknown>): T {
    const built = make(this);
    if (isThenable(built)) {
      throw new Error(`${t.name}: a factory returned a promise; I/O belongs in its start()`);
    }
    return built as T;
  }

  private remember<T>(t: Token<T>, value: unknown): T {
    this.values.set(t, value);
    return value as T;
  }

  private refuseResolved(t: Key, action: string): void {
    if (this.values.has(t)) {
      throw new Error(`${t.name} is already resolved; ${action} it before the first get()`);
    }
  }
}
