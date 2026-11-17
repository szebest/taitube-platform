import type { Token } from '@kit/di';
import { type Result, err, fromPromise, ignore, isErr, ok } from '@kit/result';
import { type Cell, TokenCells } from './token-cells';

export interface Lifecycle<T> {
  start?: (value: T) => Promise<Result<void, unknown>>;
  dispose?: (value: T) => Promise<Result<void, unknown> | void> | Result<void, unknown> | void;
}

export interface Closable {
  close(): Promise<Result<void, unknown> | void>;
}

export const closeOnDispose: Lifecycle<Closable> = { dispose: (resource) => resource.close() };

interface TokenFailed {
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

type Started = () => Promise<Result<void, unknown>>;
type Disposed = () => Promise<Result<void, unknown> | void> | Result<void, unknown> | void;

interface Constructed {
  readonly name: string;
  readonly start: Started | undefined;
  readonly dispose: Disposed | undefined;
}

const toCause = (cause: unknown): unknown => cause;

const AsyncFunction = (async () => {}).constructor;

function isThenable(value: unknown): boolean {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof Reflect.get(value, 'then') === 'function'
  );
}

function bind<T>(name: string, value: T, lifecycle: Lifecycle<T> | undefined): Constructed {
  const { start, dispose } = lifecycle ?? {};
  return {
    name,
    start: start && (() => start(value)),
    dispose: dispose && (() => dispose(value)),
  };
}

export class Container {
  private readonly providers = new TokenCells();
  private readonly overrides = new TokenCells();
  private readonly resolved = new Set<Key>();
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
    this.providers.set(t, this.lazily(t, make, lifecycle));
    return this;
  }

  override<T>(t: Token<T>, value: T): this {
    this.refuseResolved(t, 'override');
    this.overrides.set(t, { value });
    return this;
  }

  get<T>(t: Token<T>): T {
    const cell = this.overrides.get(t) ?? this.providers.get(t);
    if (!cell) throw new Error(`No provider for ${t.name}`);

    const { value } = cell;
    this.resolved.add(t);
    return value;
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
    for (const { name, start } of [...this.constructed]) {
      if (this.disposal) return err({ type: 'interrupted' });
      if (!start) continue;

      const started = await fromPromise(start, toCause);
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

    for (const { name, dispose } of [...this.constructed].reverse()) {
      if (!dispose) continue;

      this.pendingDisposer = name;
      const settled = await fromPromise(async () => dispose(), toCause);
      this.pendingDisposer = undefined;

      if (isErr(settled)) failed.push({ token: name, cause: settled.error });
      else if (settled.value && !settled.value.ok) {
        failed.push({ token: name, cause: settled.value.error });
      }
    }

    return failed.length === 0 ? ok() : err({ failed });
  }

  private lazily<T, V extends T>(
    t: Token<T>,
    make: Factory<V>,
    lifecycle: Lifecycle<V> | undefined
  ): Cell<V> {
    let built: Cell<V> | undefined;
    const construct = (): V => {
      if (this.path.includes(t)) {
        throw new Error(`Cycle: ${[...this.path, t].map((step) => step.name).join(' → ')}`);
      }

      this.path.push(t);
      let value: V;
      try {
        value = this.build(t, make);
      } finally {
        this.path.pop();
      }

      this.constructed.push(bind(t.name, value, lifecycle));
      return value;
    };

    return {
      get value() {
        built ??= { value: construct() };
        return built.value;
      },
    };
  }

  private build<V>(t: Key, make: Factory<V>): V {
    const built = make(this);
    if (isThenable(built)) {
      throw new Error(`${t.name}: a factory returned a promise; I/O belongs in its start()`);
    }
    return built;
  }

  private refuseResolved(t: Key, action: string): void {
    if (this.resolved.has(t)) {
      throw new Error(`${t.name} is already resolved; ${action} it before the first get()`);
    }
  }
}
