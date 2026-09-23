import { type QueueUnavailable, queueUnavailable } from '@vp/errors';
import { type Result, err, fromPromise, isErr, ok } from '@vp/result';
import type { ConnectionOptions } from 'bullmq';

/** What a BullMQ `Queue` and `FlowProducer` both expose over the Redis backend they own. */
export interface RedisBackendOwner {
  getBackend(): { readonly client: PromiseLike<{ readonly status: string }> };
}

export async function checkBackendHealth(
  owner: RedisBackendOwner
): Promise<Result<void, QueueUnavailable>> {
  const client = await fromPromise(
    () => owner.getBackend().client,
    (cause) => queueUnavailable('checkHealth', cause)
  );
  if (isErr(client)) return client;
  return client.value.status === 'ready'
    ? ok()
    : err(queueUnavailable('checkHealth', client.value.status));
}

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
