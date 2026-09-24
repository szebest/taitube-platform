import {
  InMemoryCacheClient,
  InMemoryDatabaseClient,
  InMemoryRepositories,
  InMemoryStorageClient,
  InMemorySubscriptionCache,
} from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import type { FastifyInstance } from 'fastify';
import { composeApp } from '../app';
import { bearer } from './in-memory-app';

export const CDN = 'http://cdn.videopipeline.local';
export const CREATOR_ID = '11111111-1111-7111-8111-111111111111';
export const OTHER_CREATOR_ID = '33333333-3333-7333-8333-333333333333';
export const SUBSCRIBER_ID = '55555555-5555-7555-8555-555555555555';
export const CHANNEL_1 = { id: '22222222-2222-7222-8222-222222222222', handle: 'creator1' };
export const CHANNEL_2 = { id: '44444444-4444-7444-8444-444444444444', handle: 'creator2' };

export const creatorToken = mintToken({ sub: CREATOR_ID, role: 'CREATOR', ttl: '1h' });
const subscriberToken = mintToken({ sub: SUBSCRIBER_ID, role: 'USER', ttl: '1h' });

export interface SubscriptionsApp {
  app: FastifyInstance;
  repos: InMemoryRepositories;
  subscriptionCache: InMemorySubscriptionCache;
}

export async function buildSubscriptionsApp(): Promise<SubscriptionsApp> {
  const repos = new InMemoryRepositories();
  const subscriptionCache = new InMemorySubscriptionCache();

  await repos.users.upsert({
    id: CREATOR_ID,
    email: 'creator@example.com',
    role: 'CREATOR',
    tier: 'pro',
  });
  await repos.users.upsert({
    id: OTHER_CREATOR_ID,
    email: 'creator2@example.com',
    role: 'CREATOR',
    tier: 'pro',
  });
  await repos.users.upsert({
    id: SUBSCRIBER_ID,
    email: 'subscriber@example.com',
    role: 'USER',
    tier: 'free',
  });
  await repos.channels.create({ ...CHANNEL_1, userId: CREATOR_ID, displayName: 'Creator One' });
  await repos.channels.create({
    ...CHANNEL_2,
    userId: OTHER_CREATOR_ID,
    displayName: 'Creator Two',
  });

  const app = (
    await composeApp({
      adapters: {
        repositories: repos,
        storage: new InMemoryStorageClient(),
        cache: new InMemoryCacheClient(),
        dbClient: new InMemoryDatabaseClient(),
        subscriptionCache,
      },
      config: inProcessAppConfig({ cdn: CDN }),
    })
  ).app;
  await app.ready();
  return { app, repos, subscriptionCache };
}

export function subscription(
  app: FastifyInstance,
  method: 'POST' | 'DELETE',
  channelId: string,
  token = subscriberToken
) {
  return app.inject({
    method,
    url: `/v1/channels/${channelId}/subscribers`,
    headers: bearer(token),
  });
}

export function getAs(app: FastifyInstance, url: string, token = subscriberToken) {
  return app.inject({ method: 'GET', url, headers: bearer(token) });
}
