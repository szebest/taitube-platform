import {
  InMemoryCacheClient,
  InMemoryJobQueue,
  InMemoryRepositories,
  InMemorySearchSuggestionIndex,
  InMemoryStorageClient,
} from '@vp/adapters/in-memory';
import type { Container } from '@vp/composition';
import type { JobQueue, StorageClient } from '@vp/core/ports';
import { mintToken } from '@vp/dev-token';
import { type ChannelRole, SEARCH_SUGGESTIONS } from '@vp/domain';
import { type AppConfig, inProcessAppConfig } from '@vp/env-schema';
import { QUEUES } from '@vp/job-contracts';
import type { Logger } from '@vp/logger';
import { SEEDED } from '@vp/testing';
import { expectOk } from '@vp/testing/result';
import type { FastifyInstance } from 'fastify';
import { type AdapterOverrides, composeApp } from '../app';

export const ADMIN_TOKEN = 'operator-token-for-tests';

const ADMIN_USER_ID = '00000000-0000-7000-8000-000000000003';

export const TOKENS = {
  admin: mintToken({ sub: ADMIN_USER_ID, role: 'admin', ttl: '1h' }),
  user: mintToken({ sub: SEEDED.userId, role: 'user', ttl: '1h' }),
  otherUser: mintToken({ sub: SEEDED.otherUserId, role: 'user', ttl: '1h' }),
};

type TestAdapters = Omit<AdapterOverrides, 'repositories' | 'cache' | 'searchSuggestions'> & {
  repositories?: InMemoryRepositories;
  cache?: InMemoryCacheClient;
  searchSuggestions?: InMemorySearchSuggestionIndex;
};

interface TestAppOptions {
  config?: AppConfig;
  adapters?: TestAdapters;
  logger?: Logger;
}

export interface TestApp {
  app: FastifyInstance;
  container: Container;
  repositories: InMemoryRepositories;
  cache: InMemoryCacheClient;
  searchSuggestions: InMemorySearchSuggestionIndex;
  storage: StorageClient;
}

/** The in-process app, not started, over the in-memory stores it hands back. */
export async function buildTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const repositories = options.adapters?.repositories ?? new InMemoryRepositories();
  const cache = options.adapters?.cache ?? new InMemoryCacheClient();
  const storage = options.adapters?.storage ?? new InMemoryStorageClient();
  const searchSuggestions =
    options.adapters?.searchSuggestions ??
    new InMemorySearchSuggestionIndex(Date.now, SEARCH_SUGGESTIONS.keptPerPrefix);
  const { app, container } = await composeApp({
    config: options.config ?? inProcessAppConfig(),
    adapters: { ...options.adapters, repositories, cache, storage, searchSuggestions },
    logger: options.logger,
  });
  return { app, container, repositories, cache, searchSuggestions, storage };
}

/** Every pipeline queue in memory, with each of `given` in place of the one it names. */
export function inMemoryQueues(...given: JobQueue[]): Map<string, JobQueue> {
  const queues = new Map<string, JobQueue>();
  for (const name of QUEUES) queues.set(name, new InMemoryJobQueue(name));
  for (const queue of given) queues.set(queue.getName(), queue);
  return queues;
}

export function bearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` };
}

type VideoInput = Parameters<InMemoryRepositories['videos']['create']>[0];

type SeedVideo = Pick<VideoInput, 'id' | 'ownerId' | 'title'> & Partial<VideoInput>;

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

const TEAM_INVITE_ID = '00000000-0000-7000-8000-00000000e117';

/**
 * Puts `memberId` on the team of `ownerId`'s channel the only way the store allows, through an
 * accepted invite; creates the owner's channel when no request has provisioned it yet.
 */
export async function seedTeamMember(
  repositories: InMemoryRepositories,
  { ownerId, memberId, role }: { ownerId: string; memberId: string; role: ChannelRole }
): Promise<string> {
  const found = expectOk(await repositories.channels.findByUserId(ownerId));
  const channel =
    found ??
    expectOk(
      await repositories.channels.create({
        userId: ownerId,
        handle: 'team-owner',
        displayName: 'Owner',
      })
    );
  const audit = {
    channelId: channel.id,
    actorUserId: ownerId,
    targetType: 'invite',
    targetId: TEAM_INVITE_ID,
    meta: { inviteeUserId: memberId, role },
  } as const;
  expectOk(
    await repositories.channelInvites.create(
      {
        id: TEAM_INVITE_ID,
        channelId: channel.id,
        inviteeUserId: memberId,
        role,
        invitedBy: ownerId,
        expiresAt: new Date(Date.now() + 3_600_000),
      },
      { ...audit, action: 'invite.created' }
    )
  );
  expectOk(
    await repositories.channelInvites.accept(TEAM_INVITE_ID, memberId, {
      ...audit,
      actorUserId: memberId,
      action: 'invite.accepted',
    })
  );
  return channel.id;
}

export async function backdate(
  repositories: InMemoryRepositories,
  videoId: string,
  createdAt: Date
): Promise<void> {
  const stored = expectOk(await repositories.videos.findById(videoId));
  if (stored) stored.createdAt = createdAt;
}
