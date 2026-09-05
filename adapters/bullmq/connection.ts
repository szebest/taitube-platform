import type { ConnectionOptions } from 'bullmq';

export function getRedisConnectionOptions(override?: ConnectionOptions): ConnectionOptions {
  if (override) return override;

  const redisUrl = process.env['REDIS_URL'];
  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl);
      const opts: ConnectionOptions = {
        host: parsed.hostname || process.env['REDIS_HOST'] || '127.0.0.1',
        port: parsed.port ? Number(parsed.port) : Number(process.env['REDIS_PORT'] ?? 6379),
      };
      if (parsed.password) {
        opts.password = decodeURIComponent(parsed.password);
      } else if (process.env['REDIS_PASSWORD']) {
        opts.password = process.env['REDIS_PASSWORD'];
      }
      if (parsed.username && parsed.username !== 'default') {
        opts.username = decodeURIComponent(parsed.username);
      }
      if (parsed.pathname && parsed.pathname.length > 1) {
        const db = Number(parsed.pathname.slice(1));
        if (!Number.isNaN(db)) opts.db = db;
      }
      return opts;
    } catch {
      // ignore URL parse errors and fall through
    }
  }

  const opts: ConnectionOptions = {
    host: process.env['REDIS_HOST'] ?? '127.0.0.1',
    port: Number(process.env['REDIS_PORT'] ?? 6379),
  };
  if (process.env['REDIS_PASSWORD']) {
    opts.password = process.env['REDIS_PASSWORD'];
  }
  return opts;
}
