export class Singleflight {
  private readonly calls = new Map<string, Promise<unknown>>();

  async do<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight<T>(key);
    if (existing) {
      return existing;
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

  private inFlight<T>(key: string): Promise<T> | undefined;
  private inFlight(key: string): Promise<unknown> | undefined {
    return this.calls.get(key);
  }

  get inFlightCount(): number {
    return this.calls.size;
  }

  clear(): void {
    this.calls.clear();
  }
}
