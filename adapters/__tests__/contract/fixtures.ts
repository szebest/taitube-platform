import type { NewVideoInput, Repositories } from '@vp/core/ports';

export const OWNER_ID = '00000000-0000-7000-8000-000000000101';
export const OTHER_OWNER_ID = '00000000-0000-7000-8000-000000000102';

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

export async function seedOwners(repositories: Repositories): Promise<void> {
  await repositories.users.upsert({ id: OWNER_ID, email: 'owner@video-pipeline.local' });
  await repositories.users.upsert({ id: OTHER_OWNER_ID, email: 'other@video-pipeline.local' });
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

export function publicVideo(overrides: Partial<NewVideoInput> & { id: string }): NewVideoInput {
  return {
    ownerId: OWNER_ID,
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
