import { mintToken } from '@vp/dev-token';
import { CANONICAL_LADDER } from '@vp/job-contracts';
import { expectOk } from '@vp/testing/result';
import { AS, CREATOR, VIDEO, type CommentsApp, sharedCommentsApp } from './comments-app';
import { bearer, seedVideo } from './test-app';

const SECOND_ADMIN = '88888888-8888-7888-8888-888888888881';
export const HELD = '88888888-8888-7888-8888-888888888882';
export const SCREENING = '88888888-8888-7888-8888-888888888883';

export const AS_SCREENING = {
  ...AS,
  secondAdmin: bearer(mintToken({ sub: SECOND_ADMIN, role: 'ADMIN', ttl: '1h' })),
};

export type ScreeningWho = keyof typeof AS_SCREENING;

export interface ScreeningApp extends CommentsApp {
  held(): string;
}

/** The comments app plus a second admin and a public video of the creator held for a duplicate of the open one. */
export async function sharedScreeningApp(): Promise<ScreeningApp> {
  const ctx = await sharedCommentsApp();
  await ctx.repositories.users.upsert({
    id: SECOND_ADMIN,
    email: 'second-admin@example.com',
    role: 'ADMIN',
    tier: 'free',
  });
  await seedVideo(ctx.repositories, {
    id: HELD,
    ownerId: CREATOR,
    title: 'A copy',
    status: 'HELD',
    ladder: CANONICAL_LADDER,
  });
  expectOk(
    await ctx.repositories.screenings.record({
      id: SCREENING,
      videoId: HELD,
      sourceChecksum: 'sum-1',
      outcome: 'HOLD',
      score: 0.97,
      reasons: [
        {
          reason: 'DUPLICATE',
          score: 0.97,
          evidence: { matchedVideoId: VIDEO, sameChannel: false },
        },
      ],
      flags: [],
      modelVersion: 'nsfw-classifier',
      thresholdVersion: 'v1',
    })
  );
  return { ...ctx, held: () => HELD };
}
