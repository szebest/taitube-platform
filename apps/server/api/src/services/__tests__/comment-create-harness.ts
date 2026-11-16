import { InMemoryRepositories } from '@vp/adapters/in-memory';
import { type CommentSettings, DEFAULT_COMMENT_SETTINGS } from '@vp/domain';
import type { UserContext } from '@vp/permissions';
import { expectOk } from '@vp/testing/result';
import { createComment } from '../comment-create';
import { commentCreateDeps, saveSettings } from './comment-deps';

export const OWNER: UserContext = { id: '11111111-1111-7111-8111-111111111111', role: 'CREATOR' };
export const VIEWER: UserContext = { id: '22222222-2222-7222-8222-222222222222', role: 'USER' };
export const OTHER: UserContext = { id: '55555555-5555-7555-8555-555555555555', role: 'USER' };
export const VIDEO_ID = '33333333-3333-7333-8333-333333333333';
export const MISSING_ID = '44444444-4444-7444-8444-444444444444';
export const START = Date.UTC(2030, 0, 1);

/** A channel with one public video, three accounts and a clock the spec moves by assigning `clock`. */
export async function setUpCommentCreate() {
  const repositories = new InMemoryRepositories();
  const harness = { repositories, clock: START, channelId: '' };
  const now = () => harness.clock;

  expectOk(
    await repositories.videos.create({
      id: VIDEO_ID,
      ownerId: OWNER.id,
      sourceKey: `raw/${VIDEO_ID}/source.mp4`,
      visibility: 'public',
      status: 'READY',
    })
  );
  harness.channelId = expectOk(
    await repositories.channels.create({ userId: OWNER.id, handle: 'owner', displayName: 'Owner' })
  ).id;
  for (const user of [OWNER, VIEWER, OTHER]) {
    const record = expectOk(
      await repositories.users.upsert({
        id: user.id,
        email: `${user.id}@example.com`,
        tier: 'free',
      })
    );
    record.createdAt = new Date(START);
  }

  return {
    ...harness,
    now,
    setClock: (at: number) => {
      harness.clock = at;
    },
    create: (author: UserContext, content = 'hi', parentId?: string) =>
      createComment(commentCreateDeps(repositories, now), author, VIDEO_ID, { content, parentId }),
    configure: (changes: Partial<CommentSettings>) =>
      saveSettings(repositories, harness.channelId, { ...DEFAULT_COMMENT_SETTINGS, ...changes }),
    storedState: async (id: string) =>
      expectOk(await repositories.comments.findById(id))?.moderationState,
  };
}

export type CommentCreateHarness = Awaited<ReturnType<typeof setUpCommentCreate>>;
