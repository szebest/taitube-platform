import { DatabaseClient } from '@vp/core/ports';

export class InMemoryDatabaseClient extends DatabaseClient {
  private healthy = true;

  setHealthy(healthy: boolean): void {
    this.healthy = healthy;
  }

  async checkHealth(): Promise<boolean> {
    return this.healthy;
  }

  async query<T = unknown>(_sql: string, _params: unknown[] = []): Promise<T[]> {
    return [];
  }

  async execute(_sql: string, _params: unknown[] = []): Promise<number> {
    return 0;
  }

  async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
    return fn(this);
  }

  async close(): Promise<void> {}
}
