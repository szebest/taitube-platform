import { type Result, err, fromPromise, isErr, ok } from '@vp/result';
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

export interface StartupFailed {
  readonly token: string;
  readonly cause: unknown;
}

export interface ShutdownFailed {
  readonly failed: readonly StartupFailed[];
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
  private pendingDisposer: string | undefined;

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

  async start(): Promise<Result<void, StartupFailed>> {
    for (const { name, value, lifecycle } of [...this.constructed]) {
      const start = lifecycle?.start;
      if (!start) continue;

      const started = await fromPromise(() => start(value), toCause);
      const failure = isErr(started) ? started.error : !started.value.ok && started.value.error;
      if (failure !== false) {
        await this.dispose();
        return err({ token: name, cause: failure });
      }
    }
    return ok();
  }

  dispose(): Promise<Result<void, ShutdownFailed>> {
    this.disposal ??= this.disposeAll();
    return this.disposal;
  }

  disposing(): string | undefined {
    return this.pendingDisposer;
  }

  private async disposeAll(): Promise<Result<void, ShutdownFailed>> {
    const failed: StartupFailed[] = [];

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
