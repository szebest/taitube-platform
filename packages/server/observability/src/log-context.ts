import { AsyncLocalStorage } from 'node:async_hooks';

export type LogBindings = Readonly<Record<string, unknown>>;

/**
 * Bindings every line written during one unit of work carries, such as the request id a job was
 * enqueued under, without handing a fresh logger to everything that unit calls.
 */
export class LogContext {
  private readonly storage = new AsyncLocalStorage<LogBindings>();

  run<T>(bindings: LogBindings, work: () => T): T {
    return this.storage.run({ ...this.current(), ...bindings }, work);
  }

  current(): LogBindings {
    return this.storage.getStore() ?? {};
  }
}
