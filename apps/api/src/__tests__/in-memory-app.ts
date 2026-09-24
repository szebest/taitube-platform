import {
  InMemoryCacheClient,
  InMemoryRepositories,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import { type AppConfig, inProcessAppConfig } from '@vp/env-schema';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { type AdapterOverrides, composeApp } from '../app';

export interface InMemoryApp {
  app: FastifyInstance;
  repositories: InMemoryRepositories;
  cache: InMemoryCacheClient;
  storage: InMemoryStorageClient;
}

export interface InMemoryAppOptions {
  config?: AppConfig;
  adapters?: AdapterOverrides;
}

export async function buildInMemoryApp(options: InMemoryAppOptions = {}): Promise<InMemoryApp> {
  const repositories = new InMemoryRepositories();
  const cache = new InMemoryCacheClient();
  const storage = new InMemoryStorageClient();
  const app = (
    await composeApp({
      config: options.config ?? inProcessAppConfig(),
      adapters: { repositories, cache, storage, ...options.adapters },
    })
  ).app;
  await app.ready();
  return { app, repositories, cache, storage };
}

export function bearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

type VideoInput = Parameters<InMemoryRepositories['videos']['create']>[0];

export type SeedVideo = Pick<VideoInput, 'id' | 'ownerId' | 'title'> & Partial<VideoInput>;

export async function seedVideo(repositories: InMemoryRepositories, video: SeedVideo) {
  return expectOk(
    await repositories.videos.create({
      visibility: 'public',
      status: 'READY',
      sourceKey: `raw/${video.id}/source.mp4`,
      ...video,
    })
  );
}

export async function backdate(
  repositories: InMemoryRepositories,
  videoId: string,
  createdAt: Date
): Promise<void> {
  const stored = expectOk(await repositories.videos.findById(videoId));
  if (stored) stored.createdAt = createdAt;
}
