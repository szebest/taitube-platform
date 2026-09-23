import type { ConnectionOptions } from 'bullmq';

/** A password the URL carries wins over the separate one, which exists for a URL without it. */
export function redisConnectionOptions(url: string, password?: string): ConnectionOptions {
  const parsed = new URL(url);
  const opts: ConnectionOptions = {
    host: parsed.hostname || '127.0.0.1',
    port: parsed.port ? Number(parsed.port) : 6379,
  };

  const urlPassword = parsed.password ? decodeURIComponent(parsed.password) : undefined;
  if (urlPassword || password) opts.password = urlPassword || password;

  if (parsed.username && parsed.username !== 'default') {
    opts.username = decodeURIComponent(parsed.username);
  }

  const db = Number(parsed.pathname.slice(1));
  if (parsed.pathname.length > 1 && !Number.isNaN(db)) opts.db = db;

  return opts;
}
