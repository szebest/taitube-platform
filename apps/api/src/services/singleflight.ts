/**
 * Singleflight promise coalescing (Go sync/singleflight pattern).
 *
 * Ensures that concurrent calls with the same key execute the underlying asynchronous
 * operation exactly once. All concurrent callers receive the same resolved value or error.
 */
export class Singleflight {
  private readonly calls = new Map<string, Promise<unknown>>();

  /**
   * Executes fn, coalescing concurrent calls with the identical key.
   */
  async do<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.calls.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = (async () => {
      try {
        return await fn();
      } finally {
        this.calls.delete(key);
      }
    })();

    this.calls.set(key, promise);
    return promise;
  }

  get inFlightCount(): number {
    return this.calls.size;
  }

  clear(): void {
    this.calls.clear();
  }
}
