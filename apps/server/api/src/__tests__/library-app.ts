import { mintToken } from '@vp/dev-token';
import type { LightMyRequestResponse } from 'fastify';
import { type TestApp, bearer, buildTestApp, seedVideo } from './test-app';

export const OWNER = '11111111-1111-7111-8111-111111111111';
const STRANGER = '22222222-2222-7222-8222-222222222222';
const ADMIN = '33333333-3333-7333-8333-333333333333';
const CREATOR = '44444444-4444-7444-8444-444444444444';

const video = (tail: string) => `66666666-6666-7666-8666-6666666666${tail}`;
export const VIDEOS = [video('a1'), video('a2'), video('a3'), video('a4'), video('a5')] as const;
export const PRIVATE_VIDEO = '77777777-7777-7777-8777-777777777777';
export const ABSENT = '99999999-9999-7999-8999-999999999999';

const AS = {
  owner: bearer(mintToken({ sub: OWNER, role: 'USER', ttl: '1h' })),
  stranger: bearer(mintToken({ sub: STRANGER, role: 'USER', ttl: '1h' })),
  admin: bearer(mintToken({ sub: ADMIN, role: 'ADMIN', ttl: '1h' })),
  anonymous: {},
};

export type Who = keyof typeof AS;

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface LibraryApp extends TestApp {
  call(
    who: Who,
    method: Method,
    url: string,
    payload?: Record<string, unknown>
  ): Promise<LightMyRequestResponse>;
  playlist(who: Who, payload?: Record<string, unknown>): Promise<string>;
  itemIds(playlistId: string): Promise<string[]>;
  order(playlistId: string): Promise<string[]>;
}

/**
 * Five public videos by a creator and one private one, and a caller of each kind. Every signed-in
 * caller goes through the auth hook, so each owns the Watch Later it provisions.
 */
export async function buildLibraryApp(): Promise<LibraryApp> {
  const testApp = await buildTestApp();
  const { app, repositories } = testApp;
  await repositories.channels.create({
    userId: CREATOR,
    handle: 'creator',
    displayName: 'Creator',
  });
  for (const [index, id] of VIDEOS.entries()) {
    await seedVideo(repositories, { id, ownerId: CREATOR, title: `Clip ${index}` });
  }
  await seedVideo(repositories, {
    id: PRIVATE_VIDEO,
    ownerId: CREATOR,
    title: 'Closed',
    visibility: 'private',
  });

  const call: LibraryApp['call'] = (who, method, url, payload) =>
    app.inject({ method, url, headers: AS[who], ...(payload ? { payload } : {}) });

  const items = async (playlistId: string) =>
    (await call('owner', 'GET', `/v1/playlists/${playlistId}`)).json().items as {
      id: string;
      videoId: string;
    }[];

  return {
    ...testApp,
    call,
    playlist: async (who, payload = { title: 'Mix' }) => {
      const res = await call(who, 'POST', '/v1/playlists', payload);
      expect(res.statusCode).toBe(201);
      return res.json().id;
    },
    itemIds: async (playlistId) => (await items(playlistId)).map((item) => item.id),
    order: async (playlistId) => (await items(playlistId)).map((item) => item.videoId),
  };
}
