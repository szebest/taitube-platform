import { InMemoryJobQueue, InMemoryRepositories } from '@vp/adapters/in-memory';
import { mintToken } from '@vp/dev-token';
import { inProcessAppConfig } from '@vp/env-schema';
import { QUEUES } from '@vp/job-contracts';
import type { FastifyInstance } from 'fastify';
import { composeApp } from '../app';

const ADMIN_USER_ID = '00000000-0000-7000-8000-000000000003';
export const OWNER_USER_ID = '00000000-0000-7000-8000-000000000001';
export const OTHER_USER_ID = '00000000-0000-7000-8000-000000000002';
export const ADMIN_TOKEN = 'operator-token-for-tests';

export interface AdminApp {
  app: FastifyInstance;
  repositories: InMemoryRepositories;
  queues: Map<string, InMemoryJobQueue>;
  probeQueue: InMemoryJobQueue;
  adminJwt: string;
  ownerJwt: string;
  otherJwt: string;
}

export async function buildAdminApp(): Promise<AdminApp> {
  const repositories = new InMemoryRepositories();
  const queues = new Map(QUEUES.map((name) => [name, new InMemoryJobQueue(name)]));
  const probeQueue = queues.get('probe');
  if (!probeQueue) throw new Error('probe queue missing');

  const app = (
    await composeApp({
      config: inProcessAppConfig({ auth: { adminToken: ADMIN_TOKEN } }),
      adapters: { repositories, queues: new Map(queues), probeQueue },
    })
  ).app;
  await app.ready();

  return {
    app,
    repositories,
    queues,
    probeQueue,
    adminJwt: mintToken({ sub: ADMIN_USER_ID, role: 'admin', ttl: '1h' }),
    ownerJwt: mintToken({ sub: OWNER_USER_ID, role: 'user', ttl: '1h' }),
    otherJwt: mintToken({ sub: OTHER_USER_ID, role: 'user', ttl: '1h' }),
  };
}
