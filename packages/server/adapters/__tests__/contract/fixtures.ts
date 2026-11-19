import { expectOk } from '@kit/testing/result';
import type { NewVideoInput, Repositories } from '@vp/core/repositories';
import type { Channel } from '@vp/domain';

export const OWNER_ID = '00000000-0000-7000-8000-000000000101';
export const OTHER_OWNER_ID = '00000000-0000-7000-8000-000000000102';

/** Each owner's primary channel, which `seedOwners` creates. */
export const OWNER_CHANNEL_ID = '00000000-0000-7000-8000-000000000901';
export const OTHER_OWNER_CHANNEL_ID = '00000000-0000-7000-8000-000000000902';

const PRIMARY_CHANNEL_OF: Readonly<Record<string, string>> = {
  [OWNER_ID]: OWNER_CHANNEL_ID,
  [OTHER_OWNER_ID]: OTHER_OWNER_CHANNEL_ID,
};

export function primaryChannelOf(userId: string): string {
  const channelId = PRIMARY_CHANNEL_OF[userId];
  if (!channelId) throw new Error(`seedOwners gives ${userId} no channel`);
  return channelId;
}

export const CATEGORY_MUSIC_ID = '00000000-0000-7000-8000-000000000201';
export const CATEGORY_GAMING_ID = '00000000-0000-7000-8000-000000000202';

export const VIDEO_IDS = {
  a: '00000000-0000-7000-8000-00000000000a',
  b: '00000000-0000-7000-8000-00000000000b',
  c: '00000000-0000-7000-8000-00000000000c',
  d: '00000000-0000-7000-8000-00000000000d',
  e: '00000000-0000-7000-8000-00000000000e',
  f: '00000000-0000-7000-8000-00000000000f',
} as const;

export const HOUR_MS = 3_600_000;

/** The owners alone, for a suite about creating their channels. */
export async function seedOwnerAccounts(repositories: Repositories): Promise<void> {
  await repositories.users.upsert({ id: OWNER_ID, email: 'owner@video-pipeline.local' });
  await repositories.users.upsert({ id: OTHER_OWNER_ID, email: 'other@video-pipeline.local' });
}

export async function seedOwners(repositories: Repositories): Promise<void> {
  await seedOwnerAccounts(repositories);
  await repositories.channels.create({
    id: OWNER_CHANNEL_ID,
    userId: OWNER_ID,
    handle: 'owner',
    displayName: 'Owner',
  });
  await repositories.channels.create({
    id: OTHER_OWNER_CHANNEL_ID,
    userId: OTHER_OWNER_ID,
    handle: 'other',
    displayName: 'Other',
  });
}

/** The primary channel `seedOwners` made for `userId`. */
export async function seededChannel(repositories: Repositories, userId: string): Promise<Channel> {
  const channel = expectOk(await repositories.channels.findById(primaryChannelOf(userId)));
  if (!channel) throw new Error(`seedOwners made no channel for ${userId}`);
  return channel;
}

export async function seedCategories(repositories: Repositories): Promise<void> {
  await repositories.categories.create({
    id: CATEGORY_MUSIC_ID,
    slug: 'music',
    name: 'Music',
    sortOrder: 1,
  });
  await repositories.categories.create({
    id: CATEGORY_GAMING_ID,
    slug: 'gaming',
    name: 'Gaming',
    sortOrder: 2,
  });
}

/** Published on the owner's primary channel unless `channelId` says otherwise. */
export function publicVideo(overrides: Partial<NewVideoInput> & { id: string }): NewVideoInput {
  const ownerId = overrides.ownerId ?? OWNER_ID;
  return {
    ownerId,
    channelId: overrides.channelId ?? primaryChannelOf(ownerId),
    sourceKey: `raw/${overrides.id}/source.mp4`,
    title: `Video ${overrides.id.slice(-1)}`,
    visibility: 'public',
    status: 'READY',
    ...overrides,
  };
}

export function idsOf(rows: readonly { id: string }[]): string[] {
  return rows.map((row) => row.id);
}
