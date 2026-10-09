import { mintToken } from '@vp/dev-token';
import type { LightMyRequestResponse } from 'fastify';
import { type TestApp, bearer, buildTestApp, seedVideo } from './test-app';

const CREATOR = '11111111-1111-7111-8111-111111111111';
export const AUTHOR = '22222222-2222-7222-8222-222222222222';
const STRANGER = '33333333-3333-7333-8333-333333333333';
const MODERATOR = '44444444-4444-7444-8444-444444444444';
const ADMIN = '55555555-5555-7555-8555-555555555555';
export const VIDEO = '66666666-6666-7666-8666-666666666666';
export const PRIVATE_VIDEO = '77777777-7777-7777-8777-777777777777';
export const ABSENT = '99999999-9999-7999-8999-999999999999';

export const AS = {
  creator: bearer(mintToken({ sub: CREATOR, role: 'CREATOR', ttl: '1h' })),
  author: bearer(mintToken({ sub: AUTHOR, role: 'USER', ttl: '1h' })),
  stranger: bearer(mintToken({ sub: STRANGER, role: 'USER', ttl: '1h' })),
  moderator: bearer(mintToken({ sub: MODERATOR, role: 'MODERATOR', ttl: '1h' })),
  admin: bearer(mintToken({ sub: ADMIN, role: 'ADMIN', ttl: '1h' })),
};

export type Who = keyof typeof AS;

export interface CommentsApp extends TestApp {
  post(
    who: Who,
    payload: { content: string; parentId?: string },
    video?: string
  ): Promise<LightMyRequestResponse>;
  comment(who: Who, content: string, parentId?: string): Promise<string>;
  list(
    query?: string,
    headers?: Record<string, string>,
    video?: string
  ): Promise<LightMyRequestResponse>;
}

/** A creator with a public and a private video, and one caller of every role. */
export async function buildCommentsApp(): Promise<CommentsApp> {
  const testApp = await buildTestApp();
  const { app, repositories } = testApp;
  for (const [id, role] of [
    [CREATOR, 'CREATOR'],
    [AUTHOR, 'USER'],
    [STRANGER, 'USER'],
    [MODERATOR, 'MODERATOR'],
    [ADMIN, 'ADMIN'],
  ] as const) {
    await repositories.users.upsert({
      id,
      email: `${id.slice(0, 4)}@example.com`,
      role,
      tier: 'free',
    });
  }
  await repositories.channels.create({
    userId: AUTHOR,
    handle: 'author',
    displayName: 'The Author',
  });
  await seedVideo(repositories, { id: VIDEO, ownerId: CREATOR, title: 'Open' });
  await seedVideo(repositories, {
    id: PRIVATE_VIDEO,
    ownerId: CREATOR,
    title: 'Closed',
    visibility: 'private',
  });

  const post: CommentsApp['post'] = (who, payload, video = VIDEO) =>
    app.inject({ method: 'POST', url: `/v1/videos/${video}/comments`, headers: AS[who], payload });

  return {
    ...testApp,
    post,
    comment: async (who, content, parentId) => {
      const res = await post(who, { content, ...(parentId ? { parentId } : {}) });
      expect(res.statusCode).toBe(201);
      return res.json().id;
    },
    list: (query = '', headers = {}, video = VIDEO) =>
      app.inject({ method: 'GET', url: `/v1/videos/${video}/comments${query}`, headers }),
  };
}
